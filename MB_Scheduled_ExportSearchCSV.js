/**
* @NApiVersion 2.x
* @NScriptType ScheduledScript
*/
define(['N/file','N/https', 'N/runtime', 'N/task'], 
	function(file, https, runtime, task ) {

        const LINELIMIT = 15000; 
        const scriptId = runtime.getCurrentScript().id; 
        const folderPath = 'MB Test/Search Exports/';

        function execute(){
            try{
                
                const process = runtime.getCurrentScript().getParameter({name : 'custscript_mb_script_process'});

                const srchId = runtime.getCurrentScript().getParameter({name : 'custscript_mb_srch_to_export'});
                const baseName = runtime.getCurrentScript().getParameter({name:'custscript_mb_base_file_name'});

                const filePath = runtime.getCurrentScript().getParameter({name : 'custscript_mb_export_file_path'});
                const exportUrl = runtime.getCurrentScript().getParameter({name: 'custscript_mb_export_url'}); 

                scriptP = 'process = ' + process;   scriptP += ' srchId = ' + srchId; 
                scriptP += ' filePath = ' + filePath;    scriptP += ' exportUrl = ' + exportUrl  + "<-----before after---> " + decodeURI(exportUrl); 
                log.debug("script parameters",scriptP);

                if(process == 'postFile'){
                    postFile(filePath,exportUrl)
                } else if (process == 'exportSearch'){
                    exportSearch(srchId,baseName,exportUrl);
                } else if (process == 'prepFile'){
                    prepForExport(filePath)
                }
 
            }catch(err){
                log.error('Error in scheduled - MB_Scheduled_ExportSearchId',JSON.stringify(err));
            }
        }
        function prepForExport(filePath){
            try{

                log.debug('fileId',filePath);
                var fileObj = file.load({id : filePath});
                fileObj.isOnline = true;
                var fileId = fileObj.save();
                log.debug('file obj',JSON.stringify(fileObj));
            } catch(err){
                log.error('error in mb_scheduled_exportsearchcsv;prepForExport', JSON.stringify(err))
            }
        
        }
        function postFile(filePath,exportUrl){
            try{

                log.debug('fileId',filePath);               ;//'153477';//'153478';//'153477';//'153265';
                var fileObj = file.load({
                    id : filePath
                });
                log.debug('file obj',JSON.stringify(fileObj));
                var name = fileObj.name;                
                var contents = ''; var files = new Array(); 
                var iterator = fileObj.lines.iterator();
                var counter = 0; 
                iterator.each(function(line){
                    contents+=line.value + '\n';
                    counter++; 
                    if(counter ==1) headerRow = line.value; 
                    if(counter == LINELIMIT) {                        
                        files.push({'body':contents,'fileName' : name.replace(".csv","_" + files.length +".csv")});
                        contents = headerRow + '\n';
                        counter = 1; 
                    }
                    return true
                });
                if(contents.length> headerRow.length) files.push({'body':contents,'fileName' : name.replace(".csv","_" + files.length +".csv")});
                // var reader = fileObj.getReader();
                //var contents = fileObj.getContents();
                //log.debug('content',contents);


                const flowUrl = exportUrl
                files.forEach(function (jsonObj){
                    var clientResponse = https.post({
                        method:https.Method.POST,
                        url : flowUrl,
                        body : JSON.stringify(jsonObj)
                    });	
                    //log.debug("clientResponse ",clientResponse);
                    if(clientResponse.code != 200){
                        //log.error("Post error : ",JSON.stringify(clientResponse));                        
                        var err = JSON.parse(clientResponse.body); 
                        log.error("Post error : ",err);                        
                    }
                    //log.debug("body",clientResponse.response);        
                    
                });
                
            } catch(err){
                log.error('error in mb_scheduled_exportsearchcsv;postFile', JSON.stringify(err))
            }

            //var results = parseCsv(contents);
            //log.debug('results',results);
        }
        
        function exportSearch(srchId,baseName,exportUrl){
            try{
                if(baseName == ''){
                    baseName = 'ExportFile_';
                } else{
                    baseName+='_';
                }

                var d = new Date();
                var month = d.getMonth()+1;
                var day   = d.getDate();
                var finalFileNameFormat = baseName+(month>9 ? month : '0'+month)+(day >9 ? day : '0'+day)+(d.getFullYear())+'_'+(d.getHours())+'_'+(d.getMinutes())+'_'+(d.getSeconds())+'.csv';
                
                var filePath = folderPath+finalFileNameFormat;
                log.debug("filePath",filePath);

                var scheduledScript = task.create({
                    taskType : task.TaskType.SCHEDULED_SCRIPT
                });

                scheduledScript.scriptId = scriptId;

                scheduledScript.params = {'custscript_mb_export_file_path':filePath,'custscript_mb_script_process': 'prepFile','custscript_mb_export_url' : exportUrl };
                /* 
                load search, update filter, save search; 
                */ 
                var searchTask = task.create({
                    taskType : task.TaskType.SEARCH
                });

                searchTask.savedSearchId = srchId;
                searchTask.filePath = filePath;
                searchTask.addInboundDependency(scheduledScript);
                
                var taskId = searchTask.submit();
                log.debug('taskId',taskId);

            } catch(err){
                log.error('error in mb_scheduled_exportsearchcsv;postFile', JSON.stringify(err))
            }   
        }
    return {
    	execute : execute
    }
});