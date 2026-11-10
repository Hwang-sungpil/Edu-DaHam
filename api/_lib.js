const VERSION='2022-06-28';
function config(){return !!(process.env.NOTION_TOKEN&&process.env.NOTION_DATABASE_ID&&process.env.ADMIN_ACCESS_TOKEN)}
async function notion(path,method='GET',body){let r=await fetch('https://api.notion.com/v1/'+path,{method,headers:{Authorization:'Bearer '+process.env.NOTION_TOKEN,'Notion-Version':VERSION,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let d=await r.json();if(!r.ok)throw Error('Notion '+r.status+': '+(d.message||'요청 실패'));return d}
function token(req){return String(req.headers['x-access-token']||'')}
function role(req,data){const k=token(req);if(!k)return null;if(k===process.env.ADMIN_ACCESS_TOKEN)return {role:'admin'};const e=data.employees.find(e=>e.active!==false&&e.token&&e.token===k);if(!e)return null;return {role:e.isClerk===true?'clerk':'employee',employeeId:e.id,department:String(e.department||'').trim()}}
function ensureAssignments(data){
 const crypto=require('crypto');const seen=new Set(data.assignments.map(a=>a.trainingId+'|'+a.employeeId));
 for(const t of data.trainings){if(t.target&&t.target!=='all')continue;
  for(const e of data.employees){if(e.active===false||e.department!==t.department)continue;
   const key=t.id+'|'+e.id;if(seen.has(key))continue;
   data.assignments.push({id:crypto.randomUUID(),employeeId:e.id,trainingId:t.id,completed:false,completedAt:''});seen.add(key);
  }
 }
 return data;
}
function scopeData(data,auth,department){
 ensureAssignments(data);
 if(auth.role==='admin'&&!department)return data;
 if(auth.role==='employee'){
  const e=data.employees.find(x=>x.id===auth.employeeId);
  const assignments=data.assignments.filter(x=>x.employeeId===auth.employeeId);
  const ids=new Set(assignments.map(x=>x.trainingId));
  return {employees:e?[{...e,token:''}]:[],trainings:data.trainings.filter(t=>ids.has(t.id)),assignments};
 }
 const dept=auth.role==='clerk'?auth.department:department;
 const employees=data.employees.filter(e=>e.department===dept).map(e=>auth.role==='clerk'?{...e,hasLink:!!e.token,token:''}:e);
 const empIds=new Set(employees.map(e=>e.id));
 const trainings=data.trainings.filter(t=>t.department===dept);
 const trainingIds=new Set(trainings.map(t=>t.id));
 return {employees,trainings,assignments:data.assignments.filter(a=>empIds.has(a.employeeId)&&trainingIds.has(a.trainingId))};
}
function mergeDepartment(current,next,dept,auth){
 if(!dept)throw Error('부서가 지정되지 않았습니다.');
 if(!valid(next))throw Error('데이터 형식 오류');
 const isAdmin=auth.role==='admin';
 const original=current.employees.filter(e=>e.department===dept);
 const originals=new Map(original.map(e=>[e.id,e]));
 const originalIds=new Set(originals.keys());
 const incoming=next.employees.map(e=>({...e,department:String(e.department||'').trim(),transferDepartment:String(e.transferDepartment||'').trim()}));
 const deleted=original.filter(e=>!incoming.some(x=>x.id===e.id));
 if(deleted.some(e=>e.isClerk))throw Error('서무주사는 직접 삭제할 수 없습니다. 서무 지정 해제 후 삭제하세요.');
 if(new Set(incoming.map(e=>e.id)).size!==incoming.length)throw Error('직원 ID 중복');
 const moving=[];const retained=[];
 for(const e of incoming){
  const prior=current.employees.find(x=>x.id===e.id);
  if(prior&&prior.department!==dept)throw Error('다른 부서 직원은 수정할 수 없습니다.');
  if(!prior&&e.department!==dept)throw Error('신규 직원은 소속 부서에만 등록할 수 있습니다.');
  if(!isAdmin){
   if(prior){
    if(e.token&&e.token!==prior.token)throw Error('로그인 링크는 발급 메뉴에서만 변경할 수 있습니다.'); e.token=prior.token||'';
   }else if(e.token)throw Error('신규 직원은 저장한 후 로그인 링크를 발급하세요.');
  }
  const dest=e.transferDepartment||e.department;
  if(e.department!==dept&&dest!==e.department)throw Error('소속 부서 직접 변경 대신 인사이동 열을 사용하세요.');
  if(dest!==dept){
   if(!prior)throw Error('신규 직원은 먼저 현 부서에 등록하세요.');
   if(!dest.trim())throw Error('이동할 부서명을 입력하세요.');
   if(!isAdmin&&prior.isClerk&&prior.id===auth.employeeId)throw Error('본인 서무 계정의 인사이동은 다른 서무 또는 전체 관리자에게 요청하세요.');
   moving.push({...e,department:dest,team:'',transferDepartment:'',isClerk:false,token:'',position:e.isClerk?'팀원':e.position});
  }else retained.push({...e,department:dept,transferDepartment:''});
 }
 if(!isAdmin&&original.some(x=>x.active!==false&&x.isClerk)&&!retained.some(x=>x.active!==false&&x.isClerk))throw Error('마지막 서무주사는 해제할 수 없습니다. 다른 서무를 먼저 지정하세요.');
 const merged=[...retained,...moving];
 const elsewhere=current.employees.filter(e=>!originalIds.has(e.id));
 const allEmployees=[...elsewhere,...merged];
 const numbers=allEmployees.map(e=>String(e.adminNumber||'').trim()).filter(Boolean);
 if(new Set(numbers).size!==numbers.length)throw Error('행정번호 중복: 다른 부서 등록 직원이 있는지 확인하세요.');
 const oldTrainIds=new Set(current.trainings.filter(t=>t.department===dept).map(t=>t.id));
 const trainings=next.trainings.map(t=>({...t,department:dept}));
 if(trainings.some(t=>current.trainings.some(x=>x.id===t.id&&x.department!==dept)))throw Error('다른 부서 교육 수정 금지');
 const trainIds=new Set(trainings.map(t=>t.id));
 if(next.assignments.some(a=>!originalIds.has(a.employeeId)&&!retained.some(e=>e.id===a.employeeId)||!trainIds.has(a.trainingId)))throw Error('타 부서 배정정보 수정 금지');
 const deletedIds=new Set(deleted.map(e=>e.id));
 const assignments=[...current.assignments.filter(a=>!deletedIds.has(a.employeeId)&&!(originalIds.has(a.employeeId)&&oldTrainIds.has(a.trainingId))),...next.assignments.filter(a=>!deletedIds.has(a.employeeId))];
 const seen=new Set(assignments.map(a=>a.trainingId+'|'+a.employeeId));
 for(const e of moving){for(const t of current.trainings){if(t.department!==e.department||t.target!=='all'||e.active===false)continue;const k=t.id+'|'+e.id;if(!seen.has(k)){assignments.push({id:require('crypto').randomUUID(),employeeId:e.id,trainingId:t.id,completed:false,completedAt:''});seen.add(k)}}}
 return ensureAssignments({...current,employees:allEmployees,trainings:[...current.trainings.filter(t=>!oldTrainIds.has(t.id)),...trainings],assignments});
}
function valid(data){return data&&Array.isArray(data.employees)&&Array.isArray(data.trainings)&&Array.isArray(data.assignments)}
async function load(){let db=process.env.NOTION_DATABASE_ID;let r=await notion('databases/'+db+'/query','POST',{page_size:100});let page=r.results.find(x=>x.properties?.Name?.title?.some(t=>t.plain_text==='EDUCATION_ON_STATE'));if(!page)return {page:null,data:{employees:[],trainings:[],assignments:[],departments:[]}};let parts=page.properties?.Payload?.rich_text||[];let s=parts.map(x=>x.plain_text||x.text?.content||'').join('');let data=s?JSON.parse(s):{employees:[],trainings:[],assignments:[],departments:[]};if(!valid(data))throw Error('Notion 데이터 형식 오류');if(!Array.isArray(data.departments))data.departments=[...new Set(data.employees.map(e=>e.department).filter(Boolean))].map(name=>({name,group:''}));return {page:page.id,data}}
async function store(data,page){if(!valid(data))throw Error('저장 형식 오류');let s=JSON.stringify(data);let parts=s.match(/[\s\S]{1,1800}/g)||[''];if(parts.length>95)throw Error('Notion 저장 한도를 초과했습니다. 데이터 분할 DB로 전환해야 합니다.');let properties={Name:{title:[{text:{content:'EDUCATION_ON_STATE'}}]},Payload:{rich_text:parts.map(x=>({text:{content:x}}))}};if(page)return notion('pages/'+page,'PATCH',{properties});return notion('pages','POST',{parent:{database_id:process.env.NOTION_DATABASE_ID},properties})}
function respond(res,code,obj){res.status(code).setHeader('Cache-Control','no-store').json(obj)}
function error(res,e){respond(res,500,{error:e.message||'서버 오류'})}
module.exports={config,load,store,role,scopeData,mergeDepartment,respond,error};
