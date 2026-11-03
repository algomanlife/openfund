import { useEffect, useState } from 'react';
import { backendUrl } from '../../session/useOpenfundSession';
export default function ReleaseStatus({locale}: {locale:'fa'|'en'}) {
  const build=__OPENFUND_BUILD__;
  const [version,setVersion]=useState(build.version === 'development' ? '' : build.version),[mismatch,setMismatch]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    Promise.all([fetch(import.meta.env.BASE_URL+'release-manifest.json',{cache:'no-store',signal:abort.signal}).then(r=>r.ok?r.json():null),fetch(backendUrl()+'/version',{cache:'no-store',credentials:'omit',signal:abort.signal}).then(r=>r.json())])
      .then(([front,back])=>{
        if(abort.signal.aborted)return;
        setVersion(front?.version || '');
        setMismatch(!!front && (back.status==='mismatch' || !back.frontend || front.commit!==build.commit || (build.version!=='development'&&front.version!==build.version) || front.commit!==back.commit || front.frontend.id!==back.frontend.id || front.backend.id!==back.backend.id));
      }).catch(()=>{});
    return ()=>abort.abort();
  },[]);
  return <>{version && <small className="of-release-version" title="Openfund release">v{version}</small>}{mismatch && <p role="alert" className="of-release-mismatch">{locale==='fa'?'نسخهٔ برنامه با سرور هماهنگ نیست. صفحه را دوباره بارگذاری کنید.':'Application and server versions differ. Reload this page.'}</p>}</>;
}
