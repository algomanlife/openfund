#!/usr/bin/env python3
"""
Openfund backstage: role-scoped Directus policies for operators (idempotent).

Three roles, each with one policy, API and Studio access, no admin access and
no delete permission anywhere. The owner keeps full access through the admin
role; these roles are for people the owner may later delegate to.

  Tournament Operator   read tournaments, registrations, standings and awards;
                        update tournament editorial copy and award fulfilment
                        notes. Never balances, accounts or payments.
  Migration Reviewer    read migration requests, evidence metadata and firms;
                        update the review note only. Decisions (approve/reject)
                        stay in Backstage behind the owner gate, so a reviewer
                        prepares a case but cannot issue an entitlement.
  Analytics Viewer      read search analytics and synonyms, campaign counters
                        and suggested searches. Read only.

Collections that do not exist yet (the tournament, migration and search
features ship in later pull requests) are skipped; re-run after each one.
Financial collections are never granted (the content-registry forbidden list).

Usage: python3 register_operator_roles.py [--url URL] [--email E] [--password P] [--dry-run]
       (env fallbacks DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD)
"""
import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

FORBIDDEN = set(json.loads((Path(__file__).resolve().parents[1] / 'content-registry.json').read_text())['editorial']['forbidden'])

ROLES = {
    'Tournament Operator': {
        'icon': 'emoji_events',
        'description': 'Openfund Premium League operations: registrations, standings and award fulfilment (no money, no deletes).',
        'permissions': [
            ('tournaments', 'read', ['*']), ('tournament_translations', 'read', ['*']),
            ('tournament_translations', 'update', ['title', 'summary', 'body']),
            ('tournament_registrations', 'read', ['id', 'tournament_id', 'status', 'nickname', 'created_at', 'disqualified_reason']),
            ('tournament_standings', 'read', ['*']), ('tournament_awards', 'read', ['*']),
            ('tournament_awards', 'update', ['fulfilment_note']),
        ],
    },
    'Migration Reviewer': {
        'icon': 'flight_land',
        'description': 'Migration to Openfund: prepares reviews of payout evidence. Decisions stay owner-gated in Backstage.',
        'permissions': [
            ('migration_firms', 'read', ['*']), ('migration_firm_translations', 'read', ['*']),
            ('migration_requests', 'read', ['id', 'status', 'firm_slug', 'largest_funded_usd', 'payout_count', 'created_at', 'decided_at', 'review_note']),
            ('migration_requests', 'update', ['review_note']),
            ('migration_evidence', 'read', ['id', 'request_id', 'kind', 'content_type', 'size_bytes', 'verified', 'created_at']),
        ],
    },
    'Analytics Viewer': {
        'icon': 'query_stats',
        'description': 'Read-only search and campaign analytics. No personal data is stored in these collections.',
        'permissions': [
            ('search_query_daily', 'read', ['*']), ('search_synonyms', 'read', ['*']), ('search_suggestions', 'read', ['*']),
            ('campaign_daily_stats', 'read', ['*']),
        ],
    },
}


def plan():
    for role, spec in ROLES.items():
        for coll, action, fields in spec['permissions']:
            if coll in FORBIDDEN:
                raise SystemExit(f'{role}: {coll} is a forbidden collection')
            if action == 'delete':
                raise SystemExit(f'{role}: delete is never granted')
    return ROLES


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD'))
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    roles = plan()
    if a.dry_run:
        for role, spec in roles.items():
            for coll, action, fields in spec['permissions']:
                print(f'{role:20} {action:6} {coll}: {",".join(fields)}')
        return
    if not a.email or not a.password:
        raise SystemExit('Directus admin credentials are required (--email/--password or env)')
    base = a.url.rstrip('/')

    def req(method, path, token=None, body=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(base + path, data=data, method=method)
        r.add_header('Content-Type', 'application/json')
        if token:
            r.add_header('Authorization', f'Bearer {token}')
        try:
            with urllib.request.urlopen(r, timeout=30) as resp:
                return json.loads(resp.read() or b'{}')
        except urllib.error.HTTPError as e:
            raise SystemExit(f'HTTP {e.code} {method} {path}\n{e.read().decode()[:400]}')

    token = req('POST', '/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']
    existing = {c['collection'] for c in req('GET', '/collections?limit=-1', token)['data']}
    for role_name, spec in roles.items():
        policy_name = f'{role_name} access'
        pol = next((p for p in req('GET', '/policies?limit=-1', token)['data'] if p['name'] == policy_name), None)
        if not pol:
            pol = req('POST', '/policies', token, {'name': policy_name, 'icon': spec['icon'], 'app_access': True, 'admin_access': False, 'description': spec['description']})['data']
            print(f'policy {policy_name}: created')
        role = next((r for r in req('GET', '/roles?limit=-1', token)['data'] if r['name'] == role_name), None)
        if not role:
            role = req('POST', '/roles', token, {'name': role_name, 'icon': spec['icon'], 'description': spec['description']})['data']
            print(f'role {role_name}: created')
        if not req('GET', f'/access?filter[role][_eq]={role["id"]}&filter[policy][_eq]={pol["id"]}', token)['data']:
            req('POST', '/access', token, {'role': role['id'], 'policy': pol['id']})
        have = {(p['collection'], p['action']): p for p in req('GET', f'/permissions?limit=-1&filter[policy][_eq]={pol["id"]}', token)['data']}
        granted = 0
        for coll, action, fields in spec['permissions']:
            if coll not in existing:
                print(f'  {role_name}: skip {coll} (not present yet)')
                continue
            if (coll, action) in have:
                req('PATCH', f"/permissions/{have[(coll, action)]['id']}", token, {'fields': fields})
            else:
                req('POST', '/permissions', token, {'policy': pol['id'], 'collection': coll, 'action': action, 'fields': fields, 'permissions': {}, 'validation': {}})
            granted += 1
        wanted = {(c, act) for c, act, _ in spec['permissions']}
        for key in [k for k in have if k not in wanted]:
            req('DELETE', f"/permissions/{have[key]['id']}", token)
            print(f'  {role_name}: removed stray permission {key[1]} {key[0]}')
        print(f'{role_name}: {granted} permissions (no delete, no financial data)')


if __name__ == '__main__':
    main()
