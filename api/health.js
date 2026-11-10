const {config,respond}=require('./_lib');module.exports=(req,res)=>respond(res,200,{configured:config()});
