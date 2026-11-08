import { useEffect, useState, type ReactNode } from 'react';
import { backendUrl } from '../../session/useOpenfundSession';
import { pick, type AppLocale } from '../../i18n/locales';
export default function ReleaseStatus({locale,children}: {locale:AppLocale;children:(version:ReactNode)=>ReactNode}) {
  const build=__OPENFUND_BUILD__;
  const [version,setVersion]=useState(build.version === 'development' ? '' : build.version);
  const [diagnostic,setDiagnostic]=useState<'missing'|'unavailable'|'mismatch'|null>(null);
  useEffect(()=>{
    const abort=new AbortController();
    Promise.all([fetch(import.meta.env.BASE_URL+'release-manifest.json',{cache:'no-store',signal:abort.signal}).then(r=>r.ok?r.json():null),fetch(backendUrl()+'/version',{cache:'no-store',credentials:'omit',signal:abort.signal}).then(r=>r.json())])
      .then(([front,back])=>{
        if(abort.signal.aborted)return;
        setVersion(front?.version || '');
        if(!front || !front.frontend || !front.backend) { setDiagnostic('missing'); return; }
        if(back.status==='unversioned' || !back.frontend || !back.backend) { setDiagnostic('unavailable'); return; }
        setDiagnostic(back.status!=='matched' || front.commit!==build.commit || (build.version!=='development'&&front.version!==build.version) || front.commit!==back.commit || front.frontend.id!==back.frontend.id || front.backend.id!==back.backend.id ? 'mismatch' : null);
      }).catch(()=>{ if(!abort.signal.aborted) setDiagnostic('unavailable'); });
    return ()=>abort.abort();
  },[]);
  const messages={
    missing: pick(locale, 'اطلاعات نسخه در دسترس نیست؛ هماهنگی نسخهٔ برنامه و سرور تأیید نشده است.', 'Release manifest is missing; application and server version compatibility is unverified.'),
    unavailable: pick(locale, 'بررسی نسخه در دسترس نیست؛ هماهنگی نسخهٔ برنامه و سرور تأیید نشده است.', 'Release verification is unavailable; application and server version compatibility is unverified.'),
    mismatch: pick(locale, 'نسخهٔ برنامه با سرور هماهنگ نیست. صفحه را دوباره بارگذاری کنید.', 'Application and server versions differ. Reload this page.'),
  };
  return <>{children(version && <small className="of-release-version" title="Openfund release">v{version}</small>)}{diagnostic && <p role="alert" className="of-release-mismatch" data-release-diagnostic={diagnostic}>{messages[diagnostic]}</p>}</>;
}
