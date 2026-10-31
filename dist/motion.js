(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const root=document.documentElement;
 const targets=[...document.querySelectorAll('.section-top,.section-heading,.intro-band,.model-section,.model-card,.features,.feature-card,.philosophy-panel,.principle-grid article,.account-presets,.builder,.steps article,.rules-section>div,.team-member,.closing')];
 targets.forEach((el,i)=>{el.dataset.reveal='';if(el.matches('.steps article,.principle-grid article'))el.style.setProperty('--reveal-delay',(i%3)*90+'ms')});
 let revealObserver;
 if(!reduced.matches&&'IntersectionObserver'in window){root.classList.add('motion-ready');revealObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');revealObserver.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -20px 0px'});targets.forEach(t=>revealObserver.observe(t));}
 const bar=document.querySelector('.scroll-progress'),header=document.querySelector('header');let scrollQueued=false;
 function updateScroll(){const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=(max>0?Math.min(100,scrollY/max*100):0)+'%';header.classList.toggle('scrolled',scrollY>30);scrollQueued=false}
 addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll)}},{passive:true});updateScroll();
 const aura=document.querySelector('.cursor-aura');let px=innerWidth/2,py=innerHeight/2,x=px,y=py,frame=null;
 function moveAura(){x+=(px-x)*.12;y+=(py-y)*.12;aura.style.transform=`translate3d(${x-325}px,${y-325}px,0)`;if(Math.abs(px-x)+Math.abs(py-y)>.5)frame=requestAnimationFrame(moveAura);else frame=null}
 addEventListener('pointermove',e=>{if(reduced.matches||!fine.matches)return;px=e.clientX;py=e.clientY;aura.classList.add('visible');if(!frame)frame=requestAnimationFrame(moveAura)},{passive:true});document.addEventListener('pointerleave',()=>aura.classList.remove('visible'));
 const card=document.querySelector('.builder .account-card');
 card.addEventListener('pointermove',e=>{if(reduced.matches||!fine.matches)return;const r=card.getBoundingClientRect();card.style.setProperty('--tilt-x',((.5-(e.clientY-r.top)/r.height)*9).toFixed(2)+'deg');card.style.setProperty('--tilt-y',(((e.clientX-r.left)/r.width-.5)*10).toFixed(2)+'deg')});
 card.addEventListener('pointerleave',()=>{card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg')});
 let switchTimer;function animateSelection(){if(reduced.matches)return;card.classList.remove('switching');requestAnimationFrame(()=>card.classList.add('switching'));clearTimeout(switchTimer);switchTimer=setTimeout(()=>card.classList.remove('switching'),600);document.querySelectorAll('.stage-fact b').forEach(el=>{el.classList.remove('changing');requestAnimationFrame(()=>el.classList.add('changing'))})}
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',animateSelection));document.querySelector('#builder-sizes').addEventListener('click',e=>{if(e.target.closest('[data-builder-size]'))animateSelection()});
 document.querySelectorAll('[data-menu-preset]').forEach(b=>b.addEventListener('click',()=>{document.querySelector(`[data-preset="${b.dataset.menuPreset}"]`).click();document.querySelector('#accounts').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});document.activeElement.blur()}));
 const teamDialog=document.querySelector('#team-dialog');
 document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#team-dialog-title').textContent=b.dataset.name;document.querySelector('#team-dialog-role').textContent=b.dataset.role;document.querySelector('#team-dialog-bio').textContent=b.dataset.bio;document.querySelector('.team-dialog-portrait').style.setProperty('--person',b.dataset.team);teamDialog.showModal()}));
 document.querySelector('.team-dialog-close').addEventListener('click',()=>teamDialog.close());teamDialog.addEventListener('click',e=>{if(e.target!==teamDialog)return;const r=teamDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)teamDialog.close()});
 const navLinks=[...document.querySelectorAll('.navlinks a[href^="#"]')];
 if('IntersectionObserver'in window){const navObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id))})},{rootMargin:'-15% 0px -65% 0px',threshold:0});navLinks.forEach(a=>{const s=document.querySelector(a.getAttribute('href'));if(s)navObserver.observe(s)})}
 reduced.addEventListener('change',()=>{if(reduced.matches){root.classList.remove('motion-ready');if(revealObserver)revealObserver.disconnect();if(frame)cancelAnimationFrame(frame);aura.classList.remove('visible');card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg')}});
})();

/* ============================================================
   MOTION v2 — magnetic buttons, smart header, scroll parallax,
   staggered reveals for additional sections
   ============================================================ */
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const root=document.documentElement;
 const live=()=>root.classList.contains('motion-ready')&&!reduced.matches;

 /* 1) Extra reveal targets + staggered children */
 const extra=[...document.querySelectorAll('.market-frame,.platform-grid article,.challenge-detail,.challenge-columns article,.rules-list details,.document-links,.footer-credits,.footer-top,.legal,.market-disclaimer')];
 extra.forEach(el=>{el.dataset.reveal=''});
 const stagger=[['.model-card',2,110],['.feature-card',2,110],['.platform-grid article',3,90],['.challenge-columns article',3,110],['.rules-list details',1,80],['.team-member',2,120],['.principle-grid article',4,70],['.steps article',3,100]];
 stagger.forEach(([sel,cols,step])=>{document.querySelectorAll(sel).forEach((el,i)=>el.style.setProperty('--reveal-delay',(i%cols)*step+'ms'))});
 let v2Observer=null;
 const arm=()=>{if(!live()){if(v2Observer){v2Observer.disconnect();v2Observer=null}return}
  if(v2Observer||!('IntersectionObserver'in window))return;
  v2Observer=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');v2Observer.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -40px 0px'});
  extra.forEach(t=>v2Observer.observe(t))};
 arm();
 reduced.addEventListener('change',()=>{if(!live())extra.forEach(t=>{t.style.opacity='';t.style.transform='';t.classList.add('revealed')});arm()});

 /* 2) Smart header: hide on scroll-down, reveal on scroll-up */
 const header=document.querySelector('header');let lastY=scrollY,hq=false;
 function headerScroll(){const y=scrollY;const dy=y-lastY;
  if(y<240||dy<-5)header.classList.remove('nav-hidden');
  else if(dy>5&&y>420)header.classList.add('nav-hidden');
  lastY=y;hq=false}
 addEventListener('scroll',()=>{if(reduced.matches)return;if(!hq){hq=true;requestAnimationFrame(headerScroll)}},{passive:true});

 /* 3) Magnetic buttons */
 document.querySelectorAll('.button,.nav-cta,.wallet-button').forEach(b=>{
  b.addEventListener('pointermove',e=>{if(!fine.matches||reduced.matches)return;const r=b.getBoundingClientRect();
   b.style.setProperty('--mag-x',((e.clientX-r.left-r.width/2)/r.width*8).toFixed(2)+'px');
   b.style.setProperty('--mag-y',((e.clientY-r.top-r.height/2)/r.height*7).toFixed(2)+'px')});
  b.addEventListener('pointerleave',()=>{b.style.setProperty('--mag-x','0px');b.style.setProperty('--mag-y','0px')})});

 /* 4) Scroll parallax: floating notes + atmosphere drift */
 const notes=[...document.querySelectorAll('.note-right,.note-left')],atmos=document.querySelector('.hero-atmosphere');
 let pq=false;
 function parallax(){const y=scrollY;
  if(y<innerHeight*1.6){
   notes.forEach((n,i)=>{const d=i===0?.07:-.1;n.style.transform=`translateY(${(y*d).toFixed(1)}px) rotate(${i===0?3:-4}deg)`});
   if(atmos)atmos.style.translate=`0 ${(y*.05).toFixed(1)}px`;
  }
  pq=false}
 addEventListener('scroll',()=>{if(reduced.matches)return;if(!pq){pq=true;requestAnimationFrame(parallax)}},{passive:true});

 /* 5) Hero product: subtle pointer tilt (composes with float animation via rotate property) */
 const product=document.querySelector('.hero-product');
 if(product&&fine.matches){
  product.addEventListener('pointermove',e=>{if(reduced.matches)return;const r=product.getBoundingClientRect();
   const ry=((e.clientX-r.left)/r.width-.5)*4;
   product.style.rotate=ry.toFixed(2)+'deg'});
  product.addEventListener('pointerleave',()=>{product.style.rotate='0deg'})}
})();
