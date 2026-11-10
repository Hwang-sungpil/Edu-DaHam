const {config,load,store,role,scopeData,mergeDepartment,respond,error}=require('./_lib');
module.exports=async(req,res)=>{try{
 if(!config())return respond(res,503,{error:'Notion 환경변수가 설정되지 않았습니다.'});
 const {page,data}=await load();const auth=role(req,data);
 if(!auth)return respond(res,403,{error:'유효하지 않은 접근키입니다.'});
 const requested=String(req.query?.department||'').trim();
 if(req.method==='GET'){
  const dept=auth.role==='admin'?requested:auth.role==='clerk'?auth.department:'';
  return respond(res,200,{role:auth.role,department:dept,departments:auth.role==='admin'?[...new Set([...(data.departments||[]).map(d=>typeof d==='string'?d.name||d:d.name),...data.employees.map(e=>e.department)].filter(Boolean))].sort():undefined,data:scopeData(data,auth,dept)});
 }
 if(req.method!=='POST')return respond(res,405,{error:'허용되지 않은 메서드'});
 if(auth.role==='employee')return respond(res,403,{error:'관리 권한 없음'});
 const next=req.body?.data;if(!next||!Array.isArray(next.employees)||!Array.isArray(next.trainings)||!Array.isArray(next.assignments))return respond(res,400,{error:'데이터 형식 오류'});
 let result;
 if(auth.role==='admin'){
  if(requested)result=mergeDepartment(data,next,requested,auth);
  else{
   const ids=next.employees.map(e=>e.adminNumber).filter(Boolean);
   if(new Set(ids).size!==ids.length)return respond(res,400,{error:'행정번호 중복'});
   result=next;
  }
 }else{
  const current=data.employees.find(e=>e.id===auth.employeeId);
  if(!current||!current.isClerk||current.department!==auth.department)return respond(res,403,{error:'서무 권한이 변경되었습니다. 다시 접속하세요.'});
  result=mergeDepartment(data,next,auth.department,auth);
 }
 await store(result,page);
 const dept=auth.role==='admin'?requested:auth.department;
 return respond(res,200,{role:auth.role,department:dept,data:scopeData(result,auth,dept)});
}catch(e){error(res,e)}};
