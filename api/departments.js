const {config,load,store,role,respond,error}=require('./_lib');
module.exports=async(req,res)=>{try{
 if(!config())return respond(res,503,{error:'Notion 연결 미설정'});
 const {page,data}=await load();const auth=role(req,data);
 if(!auth||auth.role!=='admin')return respond(res,403,{error:'전체 관리자 전용입니다.'});
 if(req.method==='GET')return respond(res,200,{departments:data.departments||[]});
 if(req.method!=='POST')return respond(res,405,{error:'POST 전용'});
 const action=String(req.body?.action||'');
 if(action==='saveDepartment'){
  const name=String(req.body?.name||'').trim(),group=String(req.body?.group||'').trim(),oldName=String(req.body?.oldName||'').trim();
  if(!name||name.length>80||group.length>80)return respond(res,400,{error:'실·과명(80자 이내)을 입력하세요.'});
  if(!Array.isArray(data.departments))data.departments=[];
  if(data.departments.some(d=>(d.name||d)===name&&(d.name||d)!==oldName))return respond(res,409,{error:'이미 등록된 부서명입니다.'});
  if(oldName){const d=data.departments.find(d=>(d.name||d)===oldName);if(!d)return respond(res,404,{error:'수정할 부서가 없습니다.'});if(typeof d==='string')data.departments.splice(data.departments.indexOf(d),1,{name,group});else Object.assign(d,{name,group});
   for(const e of data.employees)if(e.department===oldName)e.department=name;
   for(const t of data.trainings)if(t.department===oldName)t.department=name;
  }else if(!data.departments.some(d=>(d.name||d)===name))data.departments.push({name,group});
 }else if(action==='addClerk'){
  const department=String(req.body?.department||'').trim(),team=String(req.body?.team||'').trim(),name=String(req.body?.name||'').trim(),adminNumber=String(req.body?.adminNumber||'').trim(),grade=String(req.body?.grade||'').trim();
  if(!department||!name||!adminNumber)return respond(res,400,{error:'부서명·성명·행정번호는 필수입니다.'});
  if(!(data.departments||[]).some(d=>(d.name||d)===department))return respond(res,400,{error:'먼저 부서를 등록하세요.'});
  const existing=data.employees.find(e=>String(e.adminNumber||'').trim()===adminNumber);
  if(existing&&existing.department!==department)return respond(res,409,{error:'행정번호가 다른 부서에 등록되어 있습니다. 기존 부서에서 인사이동 처리하세요.'});
  if(existing){Object.assign(existing,{team,name,grade,isClerk:true,active:true,position:'서무'});}
  else data.employees.push({id:require('crypto').randomUUID(),department,team,name,adminNumber,grade,position:'서무',duty:'',active:true,isClerk:true,token:''});
 }else return respond(res,400,{error:'지원하지 않는 작업입니다.'});
 await store(data,page);
 return respond(res,200,{departments:data.departments,employees:data.employees.map(e=>({id:e.id,department:e.department,team:e.team,name:e.name,adminNumber:e.adminNumber,isClerk:e.isClerk,active:e.active,hasLink:!!e.token}))});
}catch(e){error(res,e)}};
