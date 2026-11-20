/* Tiempo fuera — aplicación estática para GitHub Pages + Supabase.
   Sin credenciales se abre DEMO LOCAL; nunca compartir datos reales en ese modo. */
const PERIOD_START = '2026-12-01';
const PERIOD_END = '2027-12-31';
const DEMO_KEY = 'tiempo_fuera_cemex_demo_v3';
const config = window.TIEMPO_FUERA_CONFIG || {};
const live = Boolean(config.supabaseUrl && config.supabaseAnonKey && !config.supabaseUrl.includes('TU-PROYECTO'));
const requiresBackend = Boolean(config.requireBackend);
let db = null;
let currentAuthUser = null;
let syncBusy = false;
let syncQueued = false;
let firstSuccessPromptedFor = new Set();
let initialAuthHTML = document.querySelector('.auth-box').innerHTML;
const months = Array.from({length:13}, (_, i) => new Date(2026, 11 + i, 1));
const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const staticHolidays = [
 ['2026-12-08','Inmaculada Concepción'],['2026-12-25','Navidad'],
 ['2027-01-01','Año Nuevo'],['2027-01-11','Reyes Magos'],['2027-03-22','San José'],
 ['2027-03-25','Jueves Santo'],['2027-03-26','Viernes Santo'],
 ['2027-05-01','Día del Trabajo'],['2027-05-10','Ascensión'],['2027-05-31','Corpus Christi'],
 ['2027-06-07','Sagrado Corazón'],['2027-07-05','San Pedro y San Pablo'],
 ['2027-07-12','Virgen de Chiquinquirá'],['2027-07-20','Independencia'],
 ['2027-08-07','Batalla de Boyacá'],['2027-08-16','Asunción'],
 ['2027-10-18','Diversidad Étnica y Cultural'],['2027-11-01','Todos los Santos'],
 ['2027-11-15','Independencia de Cartagena'],['2027-12-08','Inmaculada Concepción'],
 ['2027-12-25','Navidad']
];
function demoSeed(){
 const r=(id,n,role='member')=>({id,full_name:n,role,is_intern:false,success_days:null,seniority_days:0,seniority_reserved_days:0,seniority_scheduled_date:null,seniority_public_note:'',success_as_of:null,intern_allowance:2,special_2026:0,special_2027:0,active:true});
 return {meId:'juan',members:[r('juan','Supervisor de ejemplo','supervisor'),r('ortiz','Integrante demo 1'),r('rebolledo','Integrante demo 2'),r('pedro','Integrante demo 3'),r('isabella','Integrante demo 4'),r('eduardo','Integrante demo 5'),r('luque','Integrante demo 6')],requests:[],wildcards:[],holidays:staticHolidays.map(([day,label])=>({day,label})),wildcardYears:[{year:2026,enabled:true}],claims:[]};
}
function readDemo(){try {return {...demoSeed(),...JSON.parse(localStorage.getItem(DEMO_KEY))};}catch{return demoSeed()}}
let data = live ? {members:[],requests:[],wildcards:[],holidays:[],wildcardYears:[],claims:[],meId:null} : readDemo();
let ui = {view:'calendar',month:0,filter:'all',mineStatus:'all',controlYear:2026};
function persist(){if(!live) localStorage.setItem(DEMO_KEY,JSON.stringify(data));}
function el(id){return document.getElementById(id)}
function esc(value=''){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function isoDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function dateObj(s){let [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function daysBetween(a,b){let cur=dateObj(a),end=dateObj(b),out=[];while(cur<=end&&out.length<500){out.push(isoDate(cur));cur.setDate(cur.getDate()+1)}return out}
function fmt(s,long=false){return dateObj(s).toLocaleDateString('es-CO',long?{day:'numeric',month:'long',year:'numeric'}:{day:'2-digit',month:'short',year:'numeric'});}
function holiday(s){return data.holidays.find(h=>h.day===s)}
function isWorkday(s){const dow=dateObj(s).getDay();return dow!==0&&dow!==6&&!holiday(s)}
function workdays(a,b){return daysBetween(a,b).filter(isWorkday).length}
function vacationDays(memberId,start,end){
 const days=workdays(start,end);
 const benefits=data.wildcards.filter(w=>w.member_id===memberId && w.selected_date>=start && w.selected_date<=end && isWorkday(w.selected_date)).length;
 return Math.max(0,days-benefits);
}
function getMember(id){return data.members.find(x=>x.id===id)}
function me(){return getMember(data.meId)}
function canManage(){return me()?.role==='supervisor'}
function isActive(r){return ['approved','pending'].includes(r.status)}
function countUsed(id,type,year){return data.requests.filter(r=>r.member_id===id&&isActive(r)&&(Array.isArray(type)?type.includes(r.type):r.type===type)&&(!year||Number(r.start_date.slice(0,4))===year)).reduce((n,r)=>n+Number(r.units),0)}
function specialWindow(year){
 const today = isoDate(new Date());
 if (today > `${year}-12-31`) return 'expired';
 if (today < `${year}-01-01`) return 'upcoming';
 return 'active';
}
function available(m,type,year){
 if(type==='vacation') return m.success_days===null||m.success_days===undefined?null:Number(m.success_days)+Number(m.seniority_days||0)-Number(m.seniority_reserved_days||0)-countUsed(m.id,'vacation');
 if(type==='special_half')return Number(m[`special_${year}`]||0)-countUsed(m.id,'special_half',year)*2;
 if(type==='intern')return Number(m.intern_allowance||0)-countUsed(m.id,['intern_day','intern_half']);
 return null;
}
function nfmt(n){return n===null?'Sin cargar':Number(n).toLocaleString('es-CO',{maximumFractionDigits:1})}
function initials(full){return full.split(' ').map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()}
function typeLabel(type){return ({seniority:'Antigüedad informada',vacation:'Vacaciones',intern_day:'Libre de pasante',intern_half:'Medio día de pasante',special_half:'Medio día adicional',wildcard:'Día comodín'})[type]||type}
function statusLabel(s){return ({pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada',cancelled:'Cancelada'})[s]||s}
function personHTML(m,desc=''){return `<div class="person-line"><span class="initials">${esc(initials(m.full_name))}</span><span class="person-text"><b>${esc(m.full_name)}</b>${desc?`<span>${esc(desc)}</span>`:''}</span></div>`}
function chipStatus(s){return `<span class="pill ${esc(s)}">${esc(statusLabel(s))}</span>`}
function toast(message,error=false){let t=el('toast');t.textContent=message;t.style.background=error?'#8e4847':'#173b50';t.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.add('hidden'),5500)}
function modal(html){el('modalContent').innerHTML=html;el('modalLayer').classList.remove('hidden')}
function closeModal(){el('modalLayer').classList.add('hidden');el('modalContent').innerHTML=''}
function setView(v){ui.view=v;render()}
function header(eyebrow,title,subtitle,actions=''){return `<div class="page-header"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="subtitle">${esc(subtitle)}</p></div>${actions}</div>`}
function stat(title,value,foot,symbol='◈'){return `<div class="stat-card"><small>${esc(title)}<span>${symbol}</span></small><strong>${esc(value)}</strong><div class="stat-foot">${esc(foot)}</div></div>`}
function monthHeading(i){return `${monthNames[months[i].getMonth()]} ${months[i].getFullYear()}`}
function displayDate(r){return r.start_date===r.end_date?fmt(r.start_date):`${fmt(r.start_date)} – ${fmt(r.end_date)}`}
function wildcardOf(member,year){return data.wildcards.find(w=>w.member_id===member&&w.year===year)}
function wildcardEnabled(year){return data.wildcardYears.some(w=>Number(w.year)===year&&w.enabled)}
function pendingCount(){return data.requests.filter(r=>r.status==='pending').length}

function eventsForDay(s){
 const req=data.requests.filter(r=>isActive(r)&&r.start_date<=s&&r.end_date>=s&&isWorkday(s)
   &&!(r.type==='vacation' && data.wildcards.some(w=>w.member_id===r.member_id && w.selected_date===s))
   &&(ui.filter==='all'||r.member_id===ui.filter));
 const wc=data.wildcards.filter(w=>w.selected_date===s&&(ui.filter==='all'||w.member_id===ui.filter))
   .map(w=>({member_id:w.member_id,type:'wildcard',status:'approved'}));
 const external=data.members.filter(m=>m.seniority_scheduled_date===s&&(ui.filter==='all'||m.id===ui.filter)).map(m=>({member_id:m.id,type:'seniority',status:'informed',units:1}));
 return [...req,...wc,...external];
}
function renderCalendar(){
 const m=me(), vac=available(m,'vacation'), s26=available(m,'special_half',2026),s27=available(m,'special_half',2027);
 const ownerPending=data.requests.filter(r=>r.member_id===m.id&&r.status==='pending').length;
 const [y,mo]=[months[ui.month].getFullYear(),months[ui.month].getMonth()];
 const first=(new Date(y,mo,1).getDay()+6)%7;
 const days=new Date(y,mo+1,0).getDate();
 let tiles='';
 for(let i=0;i<42;i++){
  const d=i-first+1,inMonth=d>=1&&d<=days, dt=new Date(y,mo,d),day=isoDate(dt);
  const events=inMonth?eventsForDay(day):[],hol=inMonth?holiday(day):null;
  const wildcardDay=inMonth&&wildcardEnabled(y)&&mo===11&&(d===24||d===31);
  tiles+=`<button class="day ${inMonth?'clickable-day':'other'} ${[0,6].includes(dt.getDay())?'weekend':''} ${hol?'holiday':''}" data-action="day" data-date="${day}" ${inMonth?'':'disabled'} title="${esc(hol?.label||day)}">
   <span class="day-number"><span class="day-num-badge">${dt.getDate()}</span><span class="holiday-dot">${hol?'Festivo':wildcardDay?'★':''}</span></span>
   ${events.slice(0,3).map(r=>`<span class="event ${r.type==='vacation'?'vacation':r.type==='seniority'?'seniority':'special_half'} ${r.status==='pending'?'pending':''}" title="${esc(typeLabel(r.type))}">${esc(getMember(r.member_id)?.full_name?.split(' ')[0]||'Equipo')} · ${esc(r.type==='wildcard'?'Comodín':r.half_slot?r.half_slot.toUpperCase():typeLabel(r.type))}</span>`).join('')}
   ${events.length>3?`<span class="more-pill">+${events.length-3} más</span>`:''}
   </button>`;
 }
 const right=`<div class="side-summary">
  <div class="panel panel-pad"><div class="panel-title"><h2>Mis saldos</h2><span>◷</span></div>
   <div class="balance-row"><div><small>Vacaciones / Success + antigüedad</small><strong>${nfmt(vac)} ${vac===null?'':'días'}</strong></div></div>
   ${m.is_intern?`<div class="balance-row"><div><small>Días libres de pasante</small><strong>${nfmt(available(m,'intern'))} días</strong></div></div>`:''}
   <div class="balance-row"><div><small>Medios días de 2026</small><strong>${s26} / ${m.special_2026}</strong></div></div>
   <div class="balance-row"><div><small>Medios días de 2027</small><strong>${s27} / ${m.special_2027}</strong></div></div>
   ${Number(m.seniority_reserved_days||0)>0?`<p class="note"><b>Antigüedad:</b> ${nfmt(m.seniority_days||0)} día(s) reconocidos; ${nfmt(m.seniority_reserved_days)} ya comprometidos fuera del calendario. ${esc(m.seniority_public_note||'')}</p>`:''}
   <p class="note">Los permisos pendientes reservan saldo. El beneficio de 2026 vence el 31 de diciembre, sin acumulación.</p>
  </div>
  <div class="panel panel-pad"><div class="panel-title"><h2>Equipo</h2><span>↗</span></div><div class="people-list">${data.members.map(x=>personHTML(x,x.is_intern?'Pasante':x.role==='supervisor'?'Supervisor':'Equipo')).join('')}</div></div>
 </div>`;
 return header('VISTA GENERAL','Calendario del equipo','Visualiza las ausencias de diciembre de 2026 a diciembre de 2027.',`<button class="primary" data-action="new"><span class="button-icon">+</span> Solicitar tiempo</button>`)+
 `<div class="stat-grid">${stat('Vacaciones disponibles',nfmt(vac),vac===null?'Pendiente de Success':'Días hábiles','◷')}${stat('Medios días 2026',s26,'Vencen 31 dic 2026','◫')}${stat('Medios días 2027',s27,'Disponibles desde 1 ene 2027','◫')}${stat('Solicitudes pendientes',ownerPending,'Mis solicitudes por validar','⌛')}</div>
 <div class="content-grid"><section class="panel"><div class="calendar-head"><div class="month-control"><button class="circle-button" data-action="month" data-delta="-1" aria-label="Mes anterior" ${ui.month===0?'disabled':''}>‹</button><h2>${monthHeading(ui.month)}</h2><button class="circle-button" data-action="month" data-delta="1" aria-label="Mes siguiente" ${ui.month===12?'disabled':''}>›</button></div>
 <div class="calendar-tools"><select id="calendarFilter" aria-label="Filtrar por integrante"><option value="all">Todo el equipo</option>${data.members.map(x=>`<option value="${esc(x.id)}" ${ui.filter===x.id?'selected':''}>${esc(x.full_name)}</option>`).join('')}</select></div></div>
 <div class="calendar-grid">${['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'].map(x=>`<span class="weekday">${x}</span>`).join('')}${tiles}</div>
 <div class="calendar-legend"><span class="legend-item"><i class="legend-swatch"></i>Vacaciones</span><span class="legend-item"><i class="legend-swatch gold"></i>Medios días / comodín</span><span class="legend-item"><i class="legend-swatch dashed"></i>Por aprobar</span><span class="legend-item"><i class="legend-swatch holiday"></i>Festivos nacionales</span></div></section>${right}</div>`;
}
function renderMine(){
 const m=me();const reqs=data.requests.filter(r=>r.member_id===m.id&&(ui.mineStatus==='all'||r.status===ui.mineStatus)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const wildcardCards=data.wildcardYears.filter(y=>y.enabled).map(y=>{
  const year=Number(y.year), w=wildcardOf(m.id,year);return `<div class="panel panel-pad"><div class="panel-title"><h2>Comodín de diciembre ${year}</h2><span class="pill ${w?'approved':'pending'}">${w?'Elegido':'Por elegir'}</span></div>
   <p class="subtitle section-space">Escoge uno solo: el 24 o el 31 de diciembre. Si coincide con vacaciones, sustituye un día de descuento. No consume medios días adicionales.</p>
   <div class="toolbar section-space"><button class="${w?.selected_date===`${year}-12-24`?'primary':'outline'}" data-action="wildcard" data-year="${year}" data-day="24">24 de diciembre</button>
    <button class="${w?.selected_date===`${year}-12-31`?'primary':'outline'}" data-action="wildcard" data-year="${year}" data-day="31">31 de diciembre</button>
    ${w?`<button class="danger-btn" data-action="remove-wildcard" data-year="${year}">Quitar elección</button>`:''}</div>
   <p class="tiny">${w?`Elegiste el ${fmt(w.selected_date,true)}. Si coincide con vacaciones, el día comodín no se descontará de tu saldo.`:'Todavía no has seleccionado tu día.'}</p>
  </div>`}).join('');
 return header('MI ESPACIO','Mis solicitudes','Revisa tus permisos y elige tu día comodín.',`<button class="primary" data-action="new">+ Nueva solicitud</button>`)+
 `<div class="stat-grid">${stat('Saldo Success',nfmt(available(m,'vacation')),'Vacaciones disponibles')}${stat('Medios días 2026',available(m,'special_half',2026),'Saldo disponible')}${stat('Medios días 2027',available(m,'special_half',2027),'Saldo disponible')}${stat('Solicitudes',data.requests.filter(r=>r.member_id===m.id).length,'Histórico visible')}</div>
 <div class="two-cols"><div><div class="panel panel-pad"><div class="panel-title"><h2>Historial de solicitudes</h2><select id="mineStatus" class="input-sm"><option value="all">Todos los estados</option>${['pending','approved','rejected','cancelled'].map(s=>`<option value="${s}" ${ui.mineStatus===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></div>
  ${reqs.length?reqs.map(r=>`<div class="request-card"><div><h3>${esc(typeLabel(r.type))} ${chipStatus(r.status)}</h3><p>${esc(displayDate(r))}${r.half_slot?' · '+(r.half_slot==='am'?'Mañana':'Tarde'):''} · ${nfmt(r.units)} día(s)</p>${r.notes?`<p>${esc(r.notes)}</p>`:''}</div>${r.status==='pending'?`<button class="danger-btn" data-action="cancel" data-id="${r.id}">Cancelar</button>`:''}</div>`).join(''):`<div class="empty-state"><div class="empty-icon">◷</div><b>Sin solicitudes</b>Cuando registres un permiso, aparecerá aquí.</div>`}
 </div></div><div style="display:flex;flex-direction:column;gap:15px">${Number(m.seniority_reserved_days||0)>0?`<div class="panel panel-pad"><h2>Antigüedad comprometida</h2><p class="footnote">${esc(m.seniority_public_note||'')}</p><p class="footnote">Días reservados fuera de la aplicación: ${nfmt(m.seniority_reserved_days)}. No se descuentan de nuevo al registrar el compromiso ya contabilizado.</p></div>`:''}${wildcardCards||'<div class="panel panel-pad"><h2>Comodín</h2><p class="muted">No hay una convocatoria activa.</p></div>'}
 <div class="panel panel-pad"><h2>Reglas de saldo</h2><p class="footnote">Vacaciones: saldo inicial reportado desde Success + antigüedad, menos solicitudes pendientes o aprobadas. Pasantes: 2 días completos o 4 medios días de una misma bolsa de 2 días, sin renovación automática. Los medios días adicionales son independientes y no pasan de 2026 a 2027.</p></div>
 </div></div>`;
}
function absenceDays(){const byDay=new Map();for(const r of data.requests.filter(isActive))for(const day of daysBetween(r.start_date,r.end_date)){
 if(!isWorkday(day))continue;if(!byDay.has(day))byDay.set(day,new Set());byDay.get(day).add(r.member_id)
 }for(const m of data.members){if(!m.seniority_scheduled_date)continue;if(!byDay.has(m.seniority_scheduled_date))byDay.set(m.seniority_scheduled_date,new Set());byDay.get(m.seniority_scheduled_date).add(m.id)}for(const w of data.wildcards){if(!byDay.has(w.selected_date))byDay.set(w.selected_date,new Set());byDay.get(w.selected_date).add(w.member_id)}return byDay}
function renderControl(){
 const year=ui.controlYear;const date24=`${year}-12-24`,date31=`${year}-12-31`;
 const choices24=data.wildcards.filter(w=>w.selected_date===date24);const choices31=data.wildcards.filter(w=>w.selected_date===date31);
 const missing=data.members.filter(m=>!wildcardOf(m.id,year));
 const overlap=[...absenceDays()].filter(([day,names])=>names.size>=2).sort((a,b)=>a[0].localeCompare(b[0])).slice(0,14);
 const reqs=data.requests.filter(isActive).sort((a,b)=>a.start_date.localeCompare(b.start_date));
 const totals=`<div class="stat-grid">${stat('Integrantes',data.members.length,'Equipo activo','♙')}${stat('Comodín 24',choices24.length,`Diciembre ${year}`,'◈')}${stat('Comodín 31',choices31.length,`Diciembre ${year}`,'◈')}${stat('Sin elección',missing.length,`Comodín ${year}`,'◷')}</div>`;
 const optionYear=`<select id="controlYear" class="input-sm"><option value="2026" ${year===2026?'selected':''}>Diciembre 2026</option><option value="2027" ${year===2027?'selected':''}>Diciembre 2027</option></select>`;
 const nameGroup=(items,empty)=>items.length?items.map(w=>personHTML(getMember(w.member_id))).join(''): `<p class="muted">${empty}</p>`;
 const wildcardPanel=`<div class="panel panel-pad"><div class="panel-title"><h2>Distribución del día comodín</h2>${optionYear}</div>
  <p class="footnote">Cada persona puede elegir el 24 <b>o</b> el 31 de diciembre; no ambos. La selección se refleja en el calendario y en la cobertura.</p>
  ${!wildcardEnabled(year)?`<p class="notice-banner">La elección de ${year} aún no está habilitada.${canManage()?' Puedes activarla desde Supervisión.':''}</p>`:''}
  <div class="team-card-grid"><div class="member-card"><h3>24 de diciembre <span class="count-pill">${choices24.length}</span></h3><div class="people-list">${nameGroup(choices24,'Sin elecciones')}</div></div>
  <div class="member-card"><h3>31 de diciembre <span class="count-pill">${choices31.length}</span></h3><div class="people-list">${nameGroup(choices31,'Sin elecciones')}</div></div></div>
  <div class="section-space"><h3>Faltan por elegir</h3><div class="people-list">${missing.map(x=>personHTML(x)).join('')||'<p class="muted">Todos han elegido.</p>'}</div></div></div>`;
 const overlapsPanel=`<div class="panel panel-pad"><h2>Coincidencias de ausencias</h2><p class="footnote">Días con dos o más personas ausentes, entre solicitudes pendientes/aprobadas y comodines. Es una alerta de cobertura, no un bloqueo automático.</p>
  ${overlap.length?`<div class="alert-list">${overlap.map(([day,ids])=>`<div class="alert-item"><b>${fmt(day,true)} · ${ids.size} personas</b><div>${[...ids].map(id=>esc(getMember(id)?.full_name||'')).join(', ')}</div></div>`).join('')}</div>`:'<div class="empty-state">Sin cruces de dos o más personas en el calendario.</div>'}</div>`;
 const externalRows=data.members.filter(m=>Number(m.seniority_reserved_days||0)>0 && m.seniority_public_note).map(m=>`<tr><td>${esc(m.full_name)}</td><td>Antigüedad informada</td><td>${m.seniority_scheduled_date?fmt(m.seniority_scheduled_date):'Fechas por confirmar'}</td><td>—</td><td><span class="pill pending">Reportado</span></td></tr>`).join('');
 const schedulePanel=`<div class="panel panel-pad"><div class="panel-title"><h2>Programación registrada</h2><button class="outline" data-action="export">↓ Exportar CSV</button></div>
 <div class="table-wrap section-space"><table class="data-table"><thead><tr><th>Integrante</th><th>Tipo</th><th>Fechas</th><th>Días</th><th>Estado</th></tr></thead><tbody>${reqs.length?reqs.map(r=>`<tr><td>${esc(getMember(r.member_id)?.full_name||'')}</td><td>${esc(typeLabel(r.type))}</td><td>${esc(displayDate(r))}</td><td>${nfmt(r.units)}</td><td>${chipStatus(r.status)}</td></tr>`).join(''):''}${externalRows||(!reqs.length?'<tr><td colspan="5" class="muted">Todavía no hay permisos registrados.</td></tr>':'')}</tbody></table></div></div>`;
 return header('SEGUIMIENTO DEL ÁREA','Control del equipo',canManage()?'Vista de supervisión: cobertura, opciones de diciembre y permisos.':'Vista compartida del área: cobertura y ausencias programadas.')+totals+
 `<div class="two-cols">${wildcardPanel}${overlapsPanel}</div><div class="section-space">${schedulePanel}</div>`;
}
function renderSupervisor(){
 if(!canManage())return header('SIN ACCESO','Supervisión','Esta sección es solo para el supervisor.');
 const pending=data.requests.filter(r=>r.status==='pending').sort((a,b)=>a.start_date.localeCompare(b.start_date));
 const pendingClaims=data.claims.filter(c=>c.status==='pending');
 return header('ADMINISTRACIÓN','Supervisión del área','Aprueba ingresos, valida solicitudes y actualiza los saldos iniciales desde Success.',`<button class="outline" data-action="export">↓ Exportar consolidado</button>`)+
 `<div class="stat-grid">${stat('Permisos por validar',pending.length,'Pendientes de aprobación','⌛')}${stat('Solicitudes de acceso',pendingClaims.length,'Requieren vinculación','♙')}${stat('Sin saldo Success',data.members.filter(x=>x.success_days===null).length,'Pendientes de registrar','◷')}${stat('Total del equipo',data.members.length,'Integrantes activos','▤')}</div>
 <div class="panel panel-pad"><div class="panel-title"><h2>Solicitudes pendientes</h2></div>
  ${pending.length?pending.map(r=>`<div class="request-card"><div><h3>${esc(getMember(r.member_id)?.full_name||'')} · ${esc(typeLabel(r.type))}</h3><p>${esc(displayDate(r))} · ${r.units} días ${r.half_slot?'('+r.half_slot.toUpperCase()+')':''}</p>${r.notes?`<p>${esc(r.notes)}</p>`:''}</div><div class="request-actions"><button class="primary" data-action="review" data-id="${r.id}" data-status="approved">Aprobar</button><button class="danger-btn" data-action="review" data-id="${r.id}" data-status="rejected">Rechazar</button></div></div>`).join(''):'<div class="empty-state">No hay permisos pendientes por revisar.</div>'}</div>
 <div class="panel panel-pad section-space"><div class="panel-title"><h2>Ingresos al equipo</h2></div>
  <p class="footnote">Al iniciar sesión, cada integrante solicita asociar su correo a su nombre. Solo tú puedes aprobar el vínculo.</p>
  ${pendingClaims.length?pendingClaims.map(c=>`<div class="request-card"><div><h3>${esc(getMember(c.member_id)?.full_name||'')}</h3><p>${esc(c.email)}</p></div><div class="request-actions"><button class="primary" data-action="review-claim" data-id="${esc(c.user_id)}" data-approve="true">Autorizar</button><button class="danger-btn" data-action="review-claim" data-id="${esc(c.user_id)}" data-approve="false">Rechazar</button></div></div>`).join(''):'<p class="muted">No hay solicitudes de acceso pendientes.</p>'}</div>
 <div class="panel panel-pad section-space"><div class="panel-title"><h2>Saldos y beneficios iniciales</h2></div>
  <p class="footnote">Saldo libre = Success + antigüedad reconocida − antigüedad ya comprometida − solicitudes pendientes o aprobadas. Las reservas externas de antigüedad aparecen en el calendario y en Control del equipo; revisa las fechas con cada integrante antes de aprobar permisos.</p>
  <div class="notice-banner">Los campos en blanco de Success significan «pendiente de cargar», no 0 días. «Pasante» activa una bolsa única de 2 días o 4 medios días, configurable por persona.</div>
  ${data.members.map(m=>`<form class="admin-form-row member-edit-form" data-id="${m.id}"><div class="admin-person"><b>${esc(m.full_name)}</b><small>${m.role==='supervisor'?'Supervisor':m.is_intern?'Pasante':'Equipo'} · Vacaciones disponibles: ${nfmt(available(m,'vacation'))}</small></div>
   <div><label>Success (días)</label><input name="success_days" type="number" min="0" step="0.5" value="${m.success_days??''}" placeholder="Pendiente"></div>
   <div><label>Antigüedad</label><input name="seniority_days" type="number" min="0" step="0.5" value="${m.seniority_days||0}"></div>
   <div><label>Antig. comprometida</label><input name="seniority_reserved_days" type="number" min="0" step="0.5" value="${m.seniority_reserved_days||0}"></div>
   <div><label>Fecha antigüedad</label><input name="seniority_scheduled_date" type="date" value="${m.seniority_scheduled_date||''}"></div>
   <div class="admin-note"><label>Observación de antigüedad (visible al equipo)</label><textarea name="seniority_public_note" rows="2" maxlength="300">${esc(m.seniority_public_note||'')}</textarea></div>
   <div><label>Medios 2026</label><input name="special_2026" type="number" min="0" max="30" step="1" value="${m.special_2026||0}"></div>
   <div><label>Medios 2027</label><input name="special_2027" type="number" min="0" max="30" step="1" value="${m.special_2027||0}"></div>
   <div><label>Tipo</label><select name="is_intern"><option value="false" ${!m.is_intern?'selected':''}>Regular</option><option value="true" ${m.is_intern?'selected':''}>Pasante</option></select></div>
   <div><label>Libres pasante</label><input name="intern_allowance" type="number" min="0" step="0.5" value="${m.intern_allowance??2}"></div>
   <button type="submit" class="primary">Guardar</button></form>`).join('')}
 </div>
 <div class="panel panel-pad section-space"><div class="panel-title"><h2>Configuración de comodín</h2></div><p class="footnote">La convocatoria de diciembre de 2026 está activa. Puedes habilitar también la del año 2027 cuando corresponda.</p>
  ${wildcardEnabled(2027)?'<span class="pill approved">Diciembre 2027 habilitado</span>':'<button class="secondary" data-action="enable-2027">Habilitar elección 24 o 31 de diciembre de 2027</button>'}</div>`;
}
function maybePromptInitialSuccess(){
 const m=me();
 if(!m || m.is_intern || m.success_days!==null && m.success_days!==undefined || firstSuccessPromptedFor.has(m.id))return;
 firstSuccessPromptedFor.add(m.id);
 const today=isoDate(new Date());
 modal(`<div class="eyebrow">PRIMER INGRESO</div><h2 id="modalTitle">Tu saldo de vacaciones en Success</h2>
  <p class="modal-intro">Consulta Success y registra los días que tienes disponibles a la fecha. Este dato se captura solo una vez; si necesitas corregirlo, avisa al supervisor. El saldo no se calcula automáticamente desde Success.</p>
  <form id="initialSuccessForm" class="stack-form"><div class="form-field"><label>Días de vacaciones disponibles según Success</label><input name="success_days" type="number" min="0" max="365" step="0.5" required placeholder="Ejemplo: 12,5"></div>
  <div class="form-field"><label>Fecha de corte en Success</label><input name="success_as_of" type="date" max="2027-12-31" value="${today}" required></div>
  <div class="modal-footer"><button class="primary full" type="submit">Guardar saldo inicial</button></div></form>
  <p class="footnote">Los días adicionales por antigüedad se manejan de manera independiente. Las solicitudes futuras descuentan del saldo total.</p>`);
}
function render(){
 const m=me();if(!m){el('workspace').classList.add('hidden');return}
 el('authScreen').classList.add('hidden');el('workspace').classList.remove('hidden');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===ui.view));
 el('supervisorNav').classList.toggle('hidden',!canManage());
 el('navPendingDot').classList.toggle('hidden',!canManage()||(!pendingCount()&&!data.claims.some(c=>c.status==='pending')));
 el('userAvatar').textContent=initials(m.full_name);el('userName').textContent=m.full_name;
 el('modeTag').classList.toggle('hidden',live);
 el('logoutLabel').textContent=live?'Cerrar sesión':'Restaurar demo';
 el('breadcrumbView').textContent=({calendar:'Calendario',control:'Control del equipo',mine:'Mis solicitudes',supervisor:'Supervisión'})[ui.view];
 el('demoSwitcher').classList.toggle('hidden',live);
 if(!live){el('demoAs').innerHTML=data.members.map(x=>`<option value="${x.id}" ${x.id===data.meId?'selected':''}>${esc(x.full_name)}</option>`).join('')}
 el('pageContent').innerHTML=({calendar:renderCalendar,control:renderControl,mine:renderMine,supervisor:renderSupervisor})[ui.view]();
 maybePromptInitialSuccess();
}
function renderAuth(html){el('workspace').classList.add('hidden');el('authScreen').classList.remove('hidden');document.querySelector('.auth-box').innerHTML=html||initialAuthHTML}
async function ensureResult(p){const {data:d,error}=await p;if(error)throw error;return d}
async function reloadLive(){
 if(syncBusy){syncQueued=true;return}
 syncBusy=true;
 try{
 const user=await ensureResult(db.auth.getUser()).then(x=>x.user);
 currentAuthUser=user;
 if(!user){renderAuth();return}
 const linked=await ensureResult(db.from('team_members').select('*'));
 if(!linked?.length){
  const claimList=await ensureResult(db.rpc('list_claimable_roster'));
  const claims=await ensureResult(db.from('access_requests').select('*').eq('user_id',user.id));
  const claim=claims?.[0];data.meId=null;
  renderAuth(`<div class="logo" style="color:#203c4e;padding:0 0 30px"><span class="logo-mark">✳</span>Tiempo <b>fuera</b></div>
   <h2>Acceso al equipo</h2><p class="muted">Sesión iniciada: <b>${esc(user.email)}</b></p>
   ${claim?.status==='pending'?`<div class="notice-banner">Tu solicitud para «${esc(claimList.find(m=>m.id===claim.member_id)?.full_name||'el equipo')}» está pendiente de aprobación del supervisor.</div>`:
   `<p class="muted">Selecciona tu nombre para pedir autorización al supervisor.</p><form id="claimForm" class="stack-form"><label>Integrante</label><select id="claimMember" class="input-sm" style="max-width:none" required>${claimList.map(x=>`<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}</select><button class="primary full" type="submit" ${!claimList.length?'disabled':''}>Solicitar acceso</button></form>`}
   ${claim?.status==='rejected'?'<p class="notice-banner">La solicitud anterior fue rechazada. Puedes enviar una nueva.</p>':''}
   <button class="outline" style="margin-top:25px" data-action="logout">Cerrar sesión</button>`);
  return;
 }
 const r=await Promise.all([
  ensureResult(db.rpc('list_roster')),
  ensureResult(db.from('timeoff_requests').select('*')),
  ensureResult(db.from('wildcard_selections').select('*')),
  ensureResult(db.from('holidays').select('*')),
  ensureResult(db.from('wildcard_years').select('*')),
  linked.some(x=>x.role==='supervisor')?ensureResult(db.from('access_requests').select('*')):Promise.resolve([])
 ]);
 const [roster,requests,wildcards,holidays,wildcardYears,claims]=r;
 data={members:roster.map(x=>({...x,...(linked.find(k=>k.id===x.id)||{})})),requests,wildcards,holidays,wildcardYears,claims,
  meId:linked.find(x=>x.auth_user_id===user.id)?.id};
 if(!data.meId){renderAuth();return}
 render();
 }finally{
  syncBusy=false;
  if(syncQueued){syncQueued=false;queueMicrotask(()=>reloadLive().catch(err=>toast(err.message,true)))}
 }
}
async function refresh(){if(live)await reloadLive();else{persist();render()}}

function renderRequestModal(day='2026-12-01',otherMember=null){
 const m=me(),target=otherMember?getMember(otherMember):m;
 if(!target)return;
 let opts=`<option value="vacation">Vacaciones (días hábiles)</option>`;
 if(target.is_intern) opts+='<option value="intern_day">Día libre de pasante</option><option value="intern_half">Medio día de pasante</option>';
 if(Number(target.special_2026)>0||Number(target.special_2027)>0) opts+='<option value="special_half">Medio día adicional</option>';
 modal(`<div class="eyebrow">NUEVA SOLICITUD</div><h2 id="modalTitle">Programar un descanso</h2>
  <p class="modal-intro">La solicitud queda pendiente de aprobación. Los días hábiles excluyen sábados, domingos y festivos nacionales de Colombia.</p>
  <form id="requestForm" class="stack-form"><div class="form-grid">
   ${canManage()?`<div class="form-field span2"><label>Integrante</label><select id="reqMember" name="member_id">${data.members.map(x=>`<option value="${x.id}" ${x.id===target.id?'selected':''}>${esc(x.full_name)}</option>`).join('')}</select></div>`:`<input type="hidden" name="member_id" value="${m.id}">`}
   <div class="form-field span2"><label>Tipo de permiso</label><select id="reqType" name="type">${opts}</select></div>
   <div class="form-field"><label>Desde</label><input id="reqStart" name="start_date" type="date" value="${day}" min="${PERIOD_START}" max="${PERIOD_END}" required></div>
   <div class="form-field"><label>Hasta</label><input id="reqEnd" name="end_date" type="date" value="${day}" min="${PERIOD_START}" max="${PERIOD_END}" required></div>
   <div class="form-field span2" id="slotField" style="display:none"><label>Horario</label><select id="reqSlot" name="half_slot"><option value="am">Mañana</option><option value="pm">Tarde</option></select></div>
   <div class="form-field span2"><label>Observación (opcional)</label><textarea name="notes" maxlength="500" placeholder="Si es necesario, agrega un comentario breve"></textarea></div>
   <div class="form-field span2"><div id="requestEstimate" class="note" style="margin:0">Se descontará del saldo de vacaciones.</div></div>
  </div><div class="modal-footer"><button type="button" class="outline" data-action="close-modal">Cancelar</button><button class="primary" type="submit">Enviar solicitud</button></div></form>`);
 updateRequestForm();
}
function updateRequestForm(){
 const f=el('requestForm');if(!f)return;
 const member=getMember(el('reqMember')?.value||me().id), t=el('reqType').value;
 if(el('reqMember')){
  const keep=t,opts=['vacation',...(member.is_intern?['intern_day','intern_half']:[]),...((member.special_2026||member.special_2027)?['special_half']:[])];
  el('reqType').innerHTML=opts.map(x=>`<option value="${x}" ${x===keep?'selected':''}>${typeLabel(x)}</option>`).join('');
 }
 const type=el('reqType').value;
 el('reqEnd').disabled=type!=='vacation';
 if(type!=='vacation')el('reqEnd').value=el('reqStart').value;
 el('slotField').style.display=['intern_half','special_half'].includes(type)?'block':'none';
 const a=el('reqStart').value,b=el('reqEnd').value,year=Number(a.slice(0,4));
 const units=type==='vacation'?vacationDays(member.id,a,b):type==='intern_day'?1:.5;
 const left=type==='vacation'?available(member,'vacation'):type.startsWith('intern')?available(member,'intern'):available(member,'special_half',year)/2;
 const windowStatus=type==='special_half'?specialWindow(year):'active';
 if(windowStatus!=='active'){el('requestEstimate').textContent=windowStatus==='upcoming'?`Los medios días de ${year} se activan el 1 de enero de ese año.`:`Los medios días de ${year} ya vencieron.`;return}
 el('requestEstimate').textContent=`Se solicitarán ${nfmt(units)} día(s) de ${typeLabel(type).toLowerCase()}. ${left===null?'Debes cargar primero el saldo de Success.':`Saldo antes de solicitar: ${nfmt(left)} día(s).`}`;
}
function validateNewRequest(r){
 if(r.start_date<PERIOD_START||r.end_date>PERIOD_END||r.start_date>r.end_date)throw Error('Fechas fuera del periodo habilitado');
 if(r.start_date < isoDate(new Date()))throw Error('No puedes solicitar una fecha que ya pasó');
 if(r.type==='special_half' && specialWindow(Number(r.start_date.slice(0,4)))!=='active')throw Error('Los medios días adicionales se activan el 1 de enero de su año y vencen el 31 de diciembre');
 const member=getMember(r.member_id);if(!member)throw Error('Integrante no encontrado');
 const half=['intern_half','special_half'].includes(r.type);
 if(r.type!=='vacation'&&r.start_date!==r.end_date)throw Error('Selecciona una sola fecha para este beneficio');
 if(r.type!=='vacation'&&!isWorkday(r.start_date))throw Error('Debes escoger un día hábil');
 if(r.type==='vacation'&&vacationDays(r.member_id,r.start_date,r.end_date)<=0)throw Error('Selecciona al menos un día hábil');
 if(r.type==='special_half'&&available(member,'special_half',Number(r.start_date.slice(0,4)))<1)throw Error('No hay medios días suficientes');
 if(r.type.startsWith('intern')&&!member.is_intern)throw Error('Esta persona no está marcada como pasante');
 if(r.type!=='vacation'&&data.wildcards.some(w=>w.member_id===r.member_id&&w.selected_date>=r.start_date&&w.selected_date<=r.end_date))throw Error('El día comodín ya está asignado a esa fecha');
 if(member.seniority_scheduled_date && r.start_date<=member.seniority_scheduled_date && r.end_date>=member.seniority_scheduled_date)throw Error('La fecha cruza con el día de antigüedad informado; consulta con el supervisor');
 if(data.requests.some(x=>isActive(x)&&x.member_id===r.member_id&&x.start_date<=r.end_date&&x.end_date>=r.start_date&&(!x.half_slot||!r.half_slot||x.half_slot===r.half_slot)))throw Error('Ya existe otra solicitud que se cruza con estas fechas');
 const lim=r.type==='vacation'?available(member,'vacation'):r.type.startsWith('intern')?available(member,'intern'):available(member,'special_half',Number(r.start_date.slice(0,4)))/2;
 if(lim===null||r.units>lim)throw Error(lim===null?'Carga primero el saldo de Success':'Saldo insuficiente');
}
async function saveInitialSuccess(f){
 const obj=Object.fromEntries(new FormData(f));const days=Number(obj.success_days), asOf=obj.success_as_of;
 if(!Number.isFinite(days)||days<0||days>365||!asOf)throw Error('Ingresa un saldo y fecha de corte válidos');
 if(live)await ensureResult(db.rpc('register_initial_success',{p_days:days,p_as_of:asOf}));
 else Object.assign(me(),{success_days:days,success_as_of:asOf});
 closeModal();await refresh();toast('Saldo inicial de Success registrado.');
}
async function submitRequest(f){
 const obj=Object.fromEntries(new FormData(f));let member=getMember(obj.member_id);
 const t=obj.type;const r={member_id:obj.member_id,type:t,start_date:obj.start_date,end_date:t==='vacation'?obj.end_date:obj.start_date,
  half_slot:['intern_half','special_half'].includes(t)?obj.half_slot:null,notes:obj.notes||'',
  units:t==='vacation'?vacationDays(obj.member_id,obj.start_date,obj.end_date):t==='intern_day'?1:.5,status:'pending',created_at:new Date().toISOString()};
 validateNewRequest(r);
 if(live){await ensureResult(db.from('timeoff_requests').insert({member_id:r.member_id,type:r.type,start_date:r.start_date,end_date:r.end_date,half_slot:r.half_slot,notes:r.notes,submitted_by:currentAuthUser.id}))}
 else data.requests.push({...r,id:crypto.randomUUID?.()||String(Date.now())});
 closeModal();await refresh();toast('Solicitud registrada y pendiente de aprobación.');
}
async function chooseWildcard(year,day,member_id=me().id){
 if(!wildcardEnabled(year))throw Error('El comodín de este año aún no está habilitado');
 const previous=wildcardOf(member_id,year);
 if(previous && previous.selected_date < isoDate(new Date()))throw Error('No puedes cambiar un comodín que ya fue disfrutado');
 const date=`${year}-12-${day}`;
 if(date < isoDate(new Date()))throw Error('La fecha del comodín ya pasó');
 if(getMember(member_id)?.seniority_scheduled_date===date)throw Error('Ese día ya está señalado como antigüedad');
 if(data.requests.some(r=>r.member_id===member_id&&isActive(r)&&r.type!=='vacation'&&r.start_date<=date&&r.end_date>=date))throw Error('Ya existe otro permiso en esta fecha');
 if(live)await ensureResult(db.from('wildcard_selections').upsert({member_id,year,selected_date:date},{onConflict:'member_id,year'}));
 else {let prev=wildcardOf(member_id,year);if(prev)prev.selected_date=date;else data.wildcards.push({member_id,year,selected_date:date});}
 await refresh();toast(`Día comodín registrado: ${day} de diciembre de ${year}.`);
}
async function removeWildcard(year){const prev=wildcardOf(me().id,year);if(prev&&prev.selected_date<isoDate(new Date()))throw Error('No puedes eliminar un comodín que ya fue disfrutado');if(live)await ensureResult(db.from('wildcard_selections').delete().eq('member_id',me().id).eq('year',year));else data.wildcards=data.wildcards.filter(w=>!(w.member_id===me().id&&w.year===year));await refresh();toast('Elección de comodín eliminada.')}
async function setRequestStatus(id,status){
 const req=data.requests.find(r=>r.id===id);if(!req)throw Error('Solicitud no encontrada');
 if(!canManage()&&status!=='cancelled')throw Error('Acceso restringido al supervisor');
 if(live)await ensureResult(db.from('timeoff_requests').update({status}).eq('id',id));else req.status=status;
 await refresh();toast(status==='approved'?'Solicitud aprobada.':status==='rejected'?'Solicitud rechazada.':'Solicitud cancelada.');
}
async function saveMember(f){if(!canManage())throw Error('Solo el supervisor puede editar saldos');
 const id=f.dataset.id; const obj=Object.fromEntries(new FormData(f));
 const values={success_days:obj.success_days===''?null:Number(obj.success_days),seniority_days:Number(obj.seniority_days||0),seniority_reserved_days:Number(obj.seniority_reserved_days||0),seniority_scheduled_date:obj.seniority_scheduled_date||null,seniority_public_note:(obj.seniority_public_note||'').trim(),
  special_2026:Number(obj.special_2026),special_2027:Number(obj.special_2027),
  is_intern:obj.is_intern==='true',intern_allowance:Number(obj.intern_allowance||0)};
 if(Object.values(values).some(x=>typeof x==='number'&&!Number.isFinite(x)))throw Error('Revisa los valores numéricos');
 if(values.seniority_reserved_days>values.seniority_days)throw Error('No puedes comprometer más antigüedad de la reconocida');
 if(live)await ensureResult(db.from('team_members').update(values).eq('id',id));else Object.assign(getMember(id),values);
 await refresh();toast('Saldo de '+getMember(id).full_name+' actualizado.');
}
function exportCsv(){
 const lines=[['Integrante','Categoría','Inicio','Fin','Fracción','Días descontados','Estado','Observación'],...data.requests.map(r=>[
  getMember(r.member_id)?.full_name||'',typeLabel(r.type),r.start_date,r.end_date,r.half_slot||'completo',r.units,statusLabel(r.status),r.notes||'']),
 ...data.wildcards.map(w=>[getMember(w.member_id)?.full_name||'','Comodín',w.selected_date,w.selected_date,'completo',0,'Elegido','']),
 ...data.members.filter(m=>Number(m.seniority_reserved_days||0)>0 && m.seniority_public_note).map(m=>[m.full_name,'ANTIGÜEDAD INFORMADA',m.seniority_scheduled_date||'Por confirmar',m.seniority_scheduled_date||'', 'completo',0,'Reportado',m.seniority_public_note])];
 if(canManage())lines.push(...data.members.map(m=>[m.full_name,'SALDO INICIAL SUCCESS','','','',m.success_days??'Pendiente','',`Antigüedad ${m.seniority_days}; comprometida ${m.seniority_reserved_days||0}; medios 2026 ${m.special_2026}, 2027 ${m.special_2027}`]));
 const csv='\ufeff'+lines.map(row=>row.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`tiempo-fuera-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}

// Eventos centralizados, compatibles con contenido dinámico.
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 const act=b.dataset.action;
 try{
  if(act==='month'){ui.month=Math.min(12,Math.max(0,ui.month+Number(b.dataset.delta)));render()}
  else if(act==='new')renderRequestModal();
  else if(act==='day'){
   const date=b.dataset.date;
   if(!isWorkday(date)){toast(holiday(date)?`Festivo: ${holiday(date).label}`:'Día no hábil',true);return}
   const [year,month,day]=date.split('-').map(Number);
   if(month===12&&[24,31].includes(day)&&wildcardEnabled(year)){
    modal(`<div class="eyebrow">COMODÍN DE DICIEMBRE</div><h2 id="modalTitle">${day} de diciembre de ${year}</h2>
      <p class="modal-intro">Puedes escoger este día como tu único comodín del año. Si tienes vacaciones ese día, se descontará un día menos. No consume medios días adicionales.</p>
      <div class="modal-footer"><button class="outline" data-action="regular-day" data-date="${date}">Solicitar otro permiso</button><button class="primary" data-action="choose-day-wildcard" data-year="${year}" data-day="${day}">Escoger este comodín</button></div>`);
   }else renderRequestModal(date);
  }
  else if(act==='regular-day'){const day=b.dataset.date;renderRequestModal(day)}
  else if(act==='choose-day-wildcard'){await chooseWildcard(Number(b.dataset.year),b.dataset.day);closeModal()}
  else if(act==='close-modal')closeModal();
  else if(act==='wildcard')await chooseWildcard(Number(b.dataset.year),b.dataset.day);
  else if(act==='remove-wildcard')await removeWildcard(Number(b.dataset.year));
  else if(act==='cancel')await setRequestStatus(b.dataset.id,'cancelled');
  else if(act==='review')await setRequestStatus(b.dataset.id,b.dataset.status);
  else if(act==='review-claim'){
   if(!canManage())return;
   if(live)await ensureResult(db.rpc('review_team_access',{p_user_id:b.dataset.id,p_approve:b.dataset.approve==='true'}));
   await refresh();toast('Solicitud de acceso revisada.');
  }
  else if(act==='export')exportCsv();
  else if(act==='enable-2027'){
   if(!canManage())throw Error('Acceso restringido');
   if(live)await ensureResult(db.from('wildcard_years').upsert({year:2027,enabled:true}));
   else data.wildcardYears.push({year:2027,enabled:true});
   await refresh();toast('Comodín de diciembre 2027 habilitado.');
  }
  else if(act==='logout')await logout();
 }catch(err){toast(err.message||'No se pudo completar la operación',true)}
});
document.addEventListener('change',e=>{
 if(e.target.id==='calendarFilter'){ui.filter=e.target.value;render()}
 else if(e.target.id==='mineStatus'){ui.mineStatus=e.target.value;render()}
 else if(e.target.id==='controlYear'){ui.controlYear=Number(e.target.value);render()}
 else if(e.target.id==='demoAs'){data.meId=e.target.value;ui.view='calendar';persist();render()}
 else if(['reqType','reqMember','reqStart','reqEnd'].includes(e.target.id))updateRequestForm();
});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!['requestForm','loginForm','passwordForm','passwordChangeForm','claimForm','initialSuccessForm'].includes(f.id)&&!f.classList.contains('member-edit-form'))return;
 e.preventDefault();const btn=f.querySelector('button[type=submit]');if(btn)btn.disabled=true;
 try{
  if(f.id==='initialSuccessForm')await saveInitialSuccess(f);
  else if(f.id==='requestForm')await submitRequest(f);
  else if(f.id==='loginForm'){
   const email=el('loginEmail').value.trim();
   await ensureResult(db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}}));
   el('loginFeedback').textContent='Revisa tu correo para abrir el enlace de ingreso. Puede tardar unos minutos.';
  }
  else if(f.id==='passwordForm'){
   const obj=Object.fromEntries(new FormData(f));
   await ensureResult(db.auth.signInWithPassword({email:String(obj.email).trim(),password:obj.password}));
   await reloadLive();
  }
  else if(f.id==='passwordChangeForm'){
   const obj=Object.fromEntries(new FormData(f));
   if(obj.password!==obj.confirm_password)throw Error('Las contraseñas no coinciden');
   if(String(obj.password).length<12)throw Error('La contraseña debe tener al menos 12 caracteres');
   await ensureResult(db.auth.updateUser({password:obj.password}));
   closeModal();toast('Contraseña actualizada.');
  }
  else if(f.id==='claimForm'){
   await ensureResult(db.rpc('request_team_access',{p_member_id:el('claimMember').value}));
   await reloadLive();toast('Solicitud enviada. El supervisor deberá autorizar tu acceso.');
  }
  else if(f.classList.contains('member-edit-form'))await saveMember(f);
 }catch(err){toast(err.message||'No se pudo guardar',true)}finally{if(btn)btn.disabled=false}
});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
el('logoutBtn').addEventListener('click',()=>logout().catch(err=>toast(err.message,true)));
el('changePwdBtn').addEventListener('click',()=>modal(`<div class="eyebrow">SEGURIDAD</div><h2 id="modalTitle">Cambiar mi contraseña</h2><p class="modal-intro">Recomendamos cambiar la contraseña temporal recibida del supervisor por una nueva y personal.</p><form id="passwordChangeForm" class="stack-form"><label>Nueva contraseña</label><input name="password" type="password" minlength="12" autocomplete="new-password" required><label>Confirmar contraseña</label><input name="confirm_password" type="password" minlength="12" autocomplete="new-password" required><button class="primary full" type="submit">Actualizar contraseña</button></form>`));
el('modalClose').addEventListener('click',closeModal);
el('modalLayer').addEventListener('click',e=>{if(e.target===el('modalLayer'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
async function logout(){
 if(live){await ensureResult(db.auth.signOut());currentAuthUser=null;data.meId=null;renderAuth()}
 else{if(confirm('¿Restaurar todos los datos de la demostración local?')){data=demoSeed();persist();ui={view:'calendar',month:0,filter:'all',mineStatus:'all',controlYear:2026};render();toast('Demostración reiniciada.')}}
}
async function syncWhenIdle(){
 if(!live || !db || !currentAuthUser || document.hidden) return;
 if(!el('modalLayer').classList.contains('hidden'))return;
 const focused=document.activeElement;
 if(focused?.closest?.('form'))return;
 try{await reloadLive()}catch(err){console.warn('No se pudo actualizar el calendario',err)}
}
async function init(){
 if(live){
  renderAuth();
  try{
   const mod=await import('https://esm.sh/@supabase/supabase-js@2');
   db=mod.createClient(config.supabaseUrl,config.supabaseAnonKey);
   db.auth.onAuthStateChange(()=>setTimeout(()=>reloadLive().catch(err=>toast(err.message,true)),0));
   await reloadLive();
   setInterval(syncWhenIdle,60000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncWhenIdle()});
  }catch(err){renderAuth();toast('Error de conexión: '+err.message,true)}
 }else if(requiresBackend){
  renderAuth(`<h2>Aplicación pendiente de conexión</h2><p class="muted">Este sitio necesita una base de datos compartida para permitir el registro del equipo. Comunícate con el supervisor para su habilitación.</p>`);
 }else{render();}
}
init();