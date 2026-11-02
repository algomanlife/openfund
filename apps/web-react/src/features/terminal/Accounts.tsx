import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {backendUrl,useSession} from '../../session/useOpenfundSession';
import {useTerminal} from './TerminalContext';
import {money,route} from './model';
export function useAccounts(){
  const session=useSession(),[state,setState]=useState<{key:string;accounts:any[];error:string}>({key:'',accounts:[],error:''});
  const key=`${session.user?.id}:${session.status}`;
  useEffect(()=>{
    if(session.status!=='authenticated')return;
    const ctrl=new AbortController();let busy=false,last=0;
    const load=async()=>{if(busy || Date.now()-last<1000)return;busy=true;last=Date.now();try{const r=await fetch(backendUrl()+'/accounts',{credentials:'include',signal:ctrl.signal});if(!r.ok)throw Error('Account directory unavailable');const d=await r.json();if(!ctrl.signal.aborted)setState({key,accounts:d.accounts,error:''})}catch(e){if(!ctrl.signal.aborted)setState({key,accounts:[],error:(e as Error).message})}finally{busy=false}};
    void load();const timer=setInterval(load,15000);addEventListener('of-trading-update',load);
    return()=>{ctrl.abort();clearInterval(timer);removeEventListener('of-trading-update',load)};
  },[key]);
  return state.key===key?state:{accounts:[],error:''};
}
export function AccountPicker(){
  const {locale,product,context,t}=useTerminal(),{accounts}=useAccounts(),navigate=useNavigate();
  return <label>{t('حساب','Account')} <select aria-label="Journal account" value={context?.accountRef || ''} onChange={e=>{const a=accounts.find(a=>a.id===e.target.value);if(a)navigate(`/${locale}/${a.product}/journal?account=${encodeURIComponent(a.id)}`)}}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.id.slice(0,8)}</option>)}</select></label>;
}
export function AccountCards(){
  const {locale,t}=useTerminal(),{accounts,error}=useAccounts(),[params]=useSearchParams();
  return <section aria-label="Unified accounts"><div className="of-account-bar"><h2>{t('همهٔ حساب‌ها','All trading accounts')}</h2><span>{accounts.length} {t('حساب','accounts')}</span></div>{error && <p role="alert">{error}</p>}<div className="of-account-cards">{accounts.map(a=><Link data-account-id={a.id} className={`of-panel of-account-card ${params.get('account')===a.id?'selected':''}`} key={a.id} to={`/${locale}/${a.product}/dashboard?account=${encodeURIComponent(a.id)}`}><div className="of-account-card-heading"><h3>{a.name}</h3><span className="of-tag">{a.status.replaceAll('_',' ')}</span></div><bdi className="of-account-id">{a.id}</bdi><p>{a.type==='free_trial'?t('۱۰۰٬۰۰۰ دلار مجازی · حساب شبیه‌سازی‌شده','100,000 virtual USD · simulated account'):a.type==='perpetual'?'Gains Network · Arbitrum':t('رکورد چالش','Challenge record')}</p><dl>{[['Balance',a.balance],['Equity',a.equity],['Net PnL',a.netPnl],['Profit %',a.profitPct],['Open positions',a.openPositions],['Starting size',a.startingBalance]].map(([label,value])=><div key={String(label)}><dt>{t(({'Balance':'موجودی','Equity':'ارزش حساب','Net PnL':'سود خالص','Profit %':'درصد سود','Open positions':'پوزیشن باز','Starting size':'سرمایهٔ اولیه'} as any)[label as string],String(label))}</dt><dd dir="ltr">{value==null?'—':label==='Open positions'?String(value):money(value)} {['Balance','Equity','Net PnL','Starting size'].includes(String(label))?(a.currency || ''):''}</dd></div>)}</dl>{a.lastActivity && <small>{t('آخرین فعالیت','Last activity')}: {new Date(a.lastActivity).toLocaleString(locale==='fa'?'fa-IR':'en-US')}</small>}{a.unavailableReason && <p className="of-muted">{a.unavailableReason}</p>}<span className="of-card-action">{t('مشاهدهٔ حساب','View account')} ↗</span></Link>)}</div></section>;
}
export function AccountLinks(){
  const {locale,product,t}=useTerminal();return <nav className="of-tabs" aria-label="Account detail navigation">{[['dashboard','خلاصه','Overview'],['trade','ترمینال','Trading Terminal'],['portfolio','پوزیشن‌ها، سفارش‌ها و تاریخچه','Positions, Orders & History'],['journal','ژورنال و تحلیل','Journal & Analytics']].map(([id,fa,en])=><Link key={id} to={route(locale,product,id)}>{t(fa,en)}</Link>)}</nav>;
}
