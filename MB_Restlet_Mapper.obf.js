/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
 define([   'N/record',
            'N/error',
            'N/file',
            'N/task',
            'N/runtime',            
            'N/search',
            './lib/MBFormatFunctions.js',
            './lib/MBErrorHandler.js'            
        ],


function(record, error, file, task, runtime, search, mbformat, mberror) {
    /**
     *  
     *  Validate rest parameters. throw an error when one is missing. .
     * 
     * @param {array} args 
     * @param {array} argNames 
     * @param {string} methodName 
     */

    const MAP_HEADER = "customrecord_mb_map_header"; 
    const MAP_FIELDS_IN = "customrecord_mb_map_field_in"; 
    const MAP_INBOUND_DETAIL = "customrecord_mb_map_detail_field";     
    
    const headerFieldsAllowed = ["Customer Name","Customer Internal Id", "Order External Id", "Import Batch Id"];
    const detailFieldsAllowed = ["Items - Additional Description","Items - Item Name"];
	
    function doValidation(args, argNames, methodName) {
        for (var i = 0; i < args.length; i++)
            if (!args[i] && args[i] !== 0)
                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: [' + argNames[i] + '] for method: ' + methodName
                });
    }

    
    /**
     * 
     *      Get a standard NetSuite record
     * 
     * @param {object} context 
     * @returns {object} JSON object with data or fail guidance
     */
    function _get(context) {
        try{        

            var oLog =	{title: "get context ",details: JSON.stringify(context)};     
            log.debug(oLog);     

            doValidation([context.recordtype, context.id], ['recordtype', 'id'], 'GET');

            if(context.recordtype == "channelmap"){
                var oResult = getChannelMap(context.id,false); 
                //  mberror.flog(JSON.stringify(oResult),"channelmap");
                return oResult;
            }

            if(context.recordtype == "channelmapstore"){
                var oResult = getChannelMap(context.id,true); 
                //  mberror.flog(JSON.stringify(oResult),"channelmap");
                return oResult;
            }

            if(context.recordtype == "csvtask"){
        		var oLog = 	{title: "file id  ",details: context.id};
    			log.debug(oLog);
                var fileId = context.id; 
                var batchId = context.batchid;                 
                var importQ = context.importqueue || "1";
                var oResult = createCSVTask(fileId,batchId,importQ);
                log.debug("Results",JSON.stringify(oResult));                                
                return oResult;
    		}

            if(context.recordtype == "transactionfile"){
        		var oLog = 	{title: "file name  ",details: context.id};
    			log.debug(oLog);
                var fileName = context.id; 
                var oResult = getFileURL(fileName);
                log.debug("Results",JSON.stringify(oResult));                                
                return oResult;
    		}

            return JSON.stringify(record.load({
                type: context.recordtype,
                id: context.id
            }));
        }
        catch (ex) {
            var oLog = 	{title: "Get Error",details: JSON.stringify(ex)};
            log.error(oLog);
            var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;   
            var err = {id :  -999,success : false, message  :  errMsg }                        
            return err; 
        }
        
    }
    // Upsert a NetSuite record from request param
    function _put(context) {
        try{
            doValidation([context.recordtype, context.id], ['recordtype', 'id'], 'PUT');
            var rec = record.load({
                type: context.recordtype,
                id: context.id
            });
            for (var fldName in context)
                if (context.hasOwnProperty(fldName))
                    if (fldName !== 'recordtype' && fldName !== 'id')
                        rec.setValue({fieldId: fldName,value: context[fldName]});

            var recordId = rec.save();
            var oResult = {id: recordId};
            return oResult;
        }
        catch (ex) {
            var oLog = 	{title: "Put Error",details: JSON.stringify(ex)};
            log.error(oLog);
            var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message; 
            var err = {id :  -999,success : false, message  :  errMsg }            
            return err
        }

    }

    
    /**
     * 
     *   Delete a standard NetSuite record
     * 
     * @param {object} context 
     * @returns {JSON object} delete results.
     */
    function _delete(context) {
        log.debug("record ",JSON.stringify(context));
        doValidation([context.recordtype, context.id], ['recordtype', 'id'], 'DELETE');
        var result = record.delete({
            type: context.recordtype,
            id: context.id
        });
        var oResult = {id: result};
        return oResult;
    }

    // Create a NetSuite record from request params
    /**
     * 
     * @param {object} request 
     * @returns {JSON object} post results
     */
    function _post(request) {
        try{
            var result;
            log.debug("134 request",JSON.stringify(request)); 
            doValidation([request.recordtype], ['recordtype'], 'POST');
            // if(Array.isArray(context)){
            //     for (var index = 0; index < context.length; index++) {
            //         var rcd = context[index];
            //         oResult = createRecord(rcd);
            //         results.push(oResult);
            //     }
            // }
            if(request.recordtype == "file"){
                result =  postFile(request)
            }
            else {
                result = createRecord(request);
            }
            log.debug("Results",JSON.stringify(result));
            return result;
        }
        catch (ex) {
            var oLog = 	{title: "Post Error",details: JSON.stringify(ex)};
            log.error(oLog);
            var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;
            var err = { success : false, message  : errMsg, fileInfo : "" }                        
            return err;
        }
    }

    function postFile(request) {

        var relPath = request.columns["name"].replace(/\\/g, '/');
        var fileInfo = uploadFile(relPath, request.content);
        log.debug('output',JSON.stringify({success: true,fileInfo: fileInfo }));
        return {success: true, fileInfo: fileInfo };
      }
    
    function createRecord(request){

        //log.debug("record ",JSON.stringify(rcdToCreate));    
        var rec = record.create({
            type: request.recordtype,
            isDynamic: true
        });

        for (var fldName in request.columns){
            if (request.columns.hasOwnProperty(fldName)){
                log.debug("fld    "+ fldName, request.columns[fldName]);
                rec.setValue({fieldId: fldName,value: request.columns[fldName]});                
            }
        }
        var recordId = rec.save();
        var oResult = {success: true, id: recordId , message:''};

        return oResult;
    }

    function uploadFile(relFilePath, content) {
        var fullFilePath = relFilePath;
        
        try {
            var loadedFile = file.load({id: fullFilePath});
            var fileInfo = updateFile(loadedFile, content);
        } catch (e) {
            if (e.name == 'RCRD_DSNT_EXIST') {
                var fileInfo = createFile(fullFilePath, content);
            } else {
                throw e;
            }
        }

        log.debug({
            title: "PF fileInfo",
            details: JSON.stringify(fileInfo)
        })
        return fileInfo; 
    }

    function updateFile(existingFile, content) {
        var fileObj = file.create({
          name: existingFile.name,
          fileType: existingFile.fileType,
          contents: content,
          description: existingFile.description,
          encoding: existingFile.encoding,
          folder: existingFile.folder,
          isOnline: existingFile.isOnline
        });
        var fileId = fileObj.save();
        return {id: fileId , path: fileObj.path}
    }

    function createFile(filePath, content) {
        var pathArray = filePath.split('/');
        var name = pathArray[pathArray.length - 1];
        var fileType = file.Type.CSV;
        var folder = createFolderIfNotExist(
          filePath.substring(0, filePath.lastIndexOf('/'))
        );
    
        var fileObj = file.create({name: name,fileType: fileType,contents: content,folder: folder});
        var fileId = fileObj.save();        
        return {id: fileId, path: fileObj.path};
    }
    function createFolderIfNotExist(folderPath, parentId) {
        var folderArray = folderPath.split('/');
        var firstFolder = folderArray[0];
        var nextFolders = folderArray.slice(1);
        var filters = [];

        filters.push({name: 'name',operator: 'is',values: [firstFolder]});
        if (parentId) {
            filters.push({name: 'parent',operator: 'anyof',values: [parentId]});
        } else {
            filters.push({name: 'istoplevel',operator: 'is',values: true});
        }

        var folderSearch = search.create({type: search.Type.FOLDER,filters: filters});

        var folderId = null;
        folderSearch.run().each(function (result) {
            folderId = result.id;
            return false;
        });

        if (!folderId) {
            var folderRecord = record.create({type: record.Type.FOLDER});
            folderRecord.setValue({fieldId: 'name',value: firstFolder});
            folderRecord.setValue({fieldId: 'parent',value: parentId});
            folderId = folderRecord.save();
        }

        if (!nextFolders || nextFolders.length == 0) return folderId;

        return createFolderIfNotExist(nextFolders.join('/'), folderId);
    }

    function createCSVTask(fileId,batchId,importQ) {        
        var csvImports = (runtime.getCurrentScript().getParameter({name: 'custscript_mb_csv_import'})).split(",");
        var csvImportId = csvImports[0]; 
        
        if(batchId.substring(0,3) == "SQL" && csvImports.length >=1) csvImportId = csvImports[1]; 
        salesData = file.load(fileId);
        
        var jobName = batchId; 
        try{
            var csvTask = task.create({
                taskType: task.TaskType.CSV_IMPORT,
                mappingId: csvImportId,
                importFile: salesData,
                name: jobName,
                queueId: importQ
            });
            var csvImportTaskId = csvTask.submit();
            log.debug("csv task name ",csvTask.name); 
            // do{
                var taskStatus = task.checkStatus({taskId: csvImportTaskId}); 
                var summaryDesc =   
                        taskStatus.status === task.TaskStatus.COMPLETE     ?   "Complete" :
                        taskStatus.status === task.TaskStatus.FAILED       ?   "Failed" : 
                        taskStatus.status === task.TaskStatus.PENDING      ?   "Pending" : 
                        taskStatus.status === task.TaskStatus.PROCESSING   ?   "Processing " : "Error"; 
            // } while (summary != task.TaskStatus.COMPLETE && summary != task.TaskStatus.FAILED)
            log.audit({title: 'Status',details: summaryDesc + " "+taskStatus.status +"   "+taskStatus.status.toString()});

            var result = {id :  1,
                        success : true, 
                        message  : "success", 
                        jobName : jobName, 
                        fileId : fileId,                         
                        taskId : csvImportTaskId, 
                        taskStatus :  summaryDesc };            
            return result; 
        }
        catch(err){
            log.debug("csvCreateTask error:", JSON.stringify(err)); 
            var err = {id :  -999,success : false, message  :  err.message };
            return err;
        }
    }

    function getChannelMap(channel,isStore){
        var channelMap  = getChannelOutboundFields(channel,isStore); 
        if(channelMap.success) channelMap = getChannelInboundFields(channelMap); 
        if(channelMap.success) channelMap = getChannelInboundDTLFields(channelMap);         
        return channelMap; 
    }

    function getChannelInboundFields(channelMap){
    
        var inboundFields;
        var columns = [
            {name: "name"},                                                             //0
            {name: "custrecord_mb_map_ordinal_in",sort: search.Sort.ASC},               //1
            {name: "custrecord_mb_map_field_length_in"} ,                               //2
            {name: "custrecord_mb_data_type_in"},                                       //3
            {name: "custrecord_mb_external_key_in"},                                    //4
            {name: "custrecord_mb_tranid_composite"}                                    //5            
        ];
        var filters = [
            search.createFilter({name: "custrecord_mb_map_header_in",operator: search.Operator.ANYOF,values: channelMap.mapId}),
            search.createFilter({name: "isinactive", join:"custrecord_mb_map_header_in",  operator: search.Operator.IS  ,           values: "F"}),
            search.createFilter({name: "isinactive",                                      operator: search.Operator.IS,             values: "F"}),
        ]

        var fieldSearchObj = search.create({
            type: MAP_FIELDS_IN,
            filters:    filters,
            columns:[
                search.createColumn(columns[0]),
                search.createColumn(columns[1]),
                search.createColumn(columns[2]),
                search.createColumn(columns[3]),
                search.createColumn(columns[4]),
                search.createColumn(columns[5]),
            ]
        });
            
        var searchResultCount = fieldSearchObj.runPaged().count;
        log.debug("360 result count",searchResultCount);        
        var itemList = new Array(); 
        fieldSearchObj.run().each(function(result){
            var line = {
                ordinal    :    result.getValue(columns[1]),
                field      :    result.getValue(columns[0]),
                fieldlen   :    result.getValue(columns[2]) || 0 ,
                datatype   :    result.getText(columns[3]),
                keyfield   :    result.getValue(columns[4]) || false,
                tranfield  :    result.getValue(columns[5]) || false                
            };
            itemList.push(line);
            return true;
        });

        if(itemList.length>0){
            channelMap.success = true;            
            channelMap.inboundFields = itemList;
        }
        else {
            if(channelMap)
                { channelMap.success = false; channelMap.message = "No inbound field list"}
        }
        
        return channelMap;     
    }

    function getChannelOutboundFields(channel,isStore){
        var channelMap;
        var columns = [
            {name: "name",sort: search.Sort.ASC},                                                                   // 0 
            {name: "custrecord_mb_field_delimiter"},                                                                // 1 
            {name: "custrecord_mb_map_field",        join: "CUSTRECORD_MB_MAP_HEADER"},                             // 2 
            {name: "custrecord_mb_map_ordinal",      join: "CUSTRECORD_MB_MAP_HEADER",sort: search.Sort.ASC},       // 3 
            {name: "custrecord_mb_map_required",     join: "CUSTRECORD_MB_MAP_HEADER"},                             // 4 
            {name: "custrecord_mb_map_field_length", join: "CUSTRECORD_MB_MAP_HEADER"},                             // 5 
            {name: "custrecord_mb_map_in_link",      join: "CUSTRECORD_MB_MAP_HEADER"},                             // 6 
            {name: "custrecord_mb_customer"},                                                                       // 7
            {name: "custrecord_mb_map_in_link_dtl",  join: "CUSTRECORD_MB_MAP_HEADER"},                             // 8 
            {name: "custrecord_mb_map_header_channel"},                                                             // 9
            {name: "custrecord_mb_map_header_tranid"},                                                              // 10
            {name: "custrecord_mb_map_header_location"},                                                            // 11
            {name: "custrecord_mb_map_header_ship_method"},                                                         // 12
            {name: "custrecord_mb_additional_json"},                                                                // 13 
            {name: "custrecord_mb_map_header_que"}                                                                  // 14
        ];

        var filters = new Array();
        if(!isStore)
            filters.push(search.createFilter({name: "name", operator: search.Operator.IS,     values: channel}));
        else{
            filters.push(search.createFilter({name: "custrecord_mb_shipworks_store_id", operator: search.Operator.IS,     values: channel}));
        }
        filters.push(search.createFilter({name: "isinactive",                                    operator: search.Operator.IS,             values: "F"})); 
        filters.push(search.createFilter({name: "isinactive", join:"custrecord_mb_map_header",   operator: search.Operator.IS  ,           values: "F"})); 

        var fieldSearchObj = search.create({
            type: MAP_HEADER,
            filters:  filters,
            columns:[
                search.createColumn(columns[0]),
                search.createColumn(columns[1]),
                search.createColumn(columns[2]),
                search.createColumn(columns[3]),
                search.createColumn(columns[4]),
                search.createColumn(columns[5]),
                search.createColumn(columns[6]),
                search.createColumn(columns[7]),
                search.createColumn(columns[8]),
                search.createColumn(columns[9]),                
                search.createColumn(columns[10]),
                search.createColumn(columns[11]),
                search.createColumn(columns[12]),
                search.createColumn(columns[13])
            ]
        });

        var dNames = ["Comma","Tab","Pipe","Semicolon","None"]; 
        var dChars = ["44","09","124","59","20"]; 

        var itemList = new Array(); 
        fieldSearchObj.run().each(function(result){
            if(!channelMap){
                var delimiterAsciiCode = dChars[dNames.indexOf(result.getText(columns[1]))];                
                channelMap = {
                    delimiter           :  delimiterAsciiCode,
                    mapName             :  result.getValue(columns[0]),
                    customerId          :  result.getValue(columns[7]),
                    channelId           :  result.getValue(columns[9]),
                    mapId               :  result.id,
                    tranIdComposite     :  result.getValue(columns[10]) ||'',
                    defaultLocation     :  result.getValue(columns[11]) ||'',
                    defaultShipMethod   :  result.getValue(columns[12]) ||'',
                    additionalFields    :  result.getValue(columns[13]) ||''
                }
            }
            const ITEMS = "Items - "; 
            var line = {
                ordinal    :    result.getValue(columns[3]) || 0,
                field      :    result.getText(columns[2]),
                infield    :    result.getText(columns[6]) || result.getText(columns[8]),                
                fieldlen   :    result.getValue(columns[5]) || 0 ,
                datatype   :    "string",                                           // not actually used done for serialization
                detaillevel:    (result.getText(columns[8]) || result.getText(columns[2]).indexOf(ITEMS)>= 0) ? true : false
            };  

            if(headerFieldsAllowed.indexOf(line.field)>=0) line.detaillevel = false; 
            if(detailFieldsAllowed.indexOf(line.field)>=0) line.detaillevel = true; 
            itemList.push(line);
            return true;
        });
        if(itemList.length>0){
            channelMap.success = true;            
            channelMap.outboundFields = itemList;
        }
        else {
            if(channelMap)
                { channelMap.success = false; channelMap.message = "No outbound field list"}
            else
                var channelMap = {success : false , message :  "No maps found for channel ~1".replace("~1",channel)};
        }
        // log.debug("channelMap",JSON.stringify(channelMap));
        return channelMap;
    }    
    function getChannelInboundDTLFields(channelMap){
        var columns = [
            {name: "name"},                                                                 // 0 
            {name: "custrecord_mb_map_data_type_dt"},                                       // 1
            {name: "custrecord_mb_map_ordinal_dt",sort: search.Sort.ASC},                   // 2
            {name: "custrecord_mb_map_field_length_dt"}                                     // 3
        ];
// 
        log.debug("channelMap.mapId",channelMap.mapId);
        var filters = [
            search.createFilter({name: "custrecord_mb_map_header_dt",               operator: search.Operator.ANYOF,values: channelMap.mapId}),            
            search.createFilter({name: "isinactive",                                    operator: search.Operator.IS,           values: "F"}),            
            search.createFilter({name: "isinactive", join:"custrecord_mb_map_header_dt",operator: search.Operator.IS  ,         values: "F"}),

        ];
        try{
        var fieldSearchObj = search.create({
            type: MAP_INBOUND_DETAIL,
            filters:  filters,
            columns:[
                search.createColumn(columns[0]),
                search.createColumn(columns[1]),
                search.createColumn(columns[2]),                
                search.createColumn(columns[3]),
            ]
        });
        var searchResultCount = fieldSearchObj.runPaged().count;
        log.debug("result count",searchResultCount);        

        var itemList = new Array(); 
        fieldSearchObj.run().each(function(result){
            var line = {
                ordinal    :    result.getValue(columns[2]) || 0,
                field      :    result.getValue(columns[0]),
                fieldlen   :    result.getValue(columns[3]) || 0 ,                
                datatype   :    result.getText(columns[1])
            };            
            itemList.push(line);
            return true;
        });
        if(itemList.length>0){
            channelMap.inboundDetailFields = itemList;
        }else{channelMap.inboundDetailFields = [];}

        // dont want the map to fail cause certain maps never have detail.
        // else {
        //     if(channelMap)
        //         { channelMap.success = false; channelMap.message = "No outbound detail field list"}
        // }
        return channelMap;
        }catch(err){log.debug("473 search error",JSON.stringify(err));};        
    }    
    // returns the URL for a file name for external downloads. 
    function getFileURL(fileName){
        const baseFolder = "7324";

        var folderSearchObj = search.create({
            type: "folder",
            filters:
            [
               ["predecessor","anyof",baseFolder], 
               "AND", ["file.name","startswith",fileName],
               "AND", ["file.availablewithoutlogin","is","T"]            ],
            columns:
            [
               search.createColumn({name: "created",join: "file",sort: search.Sort.DESC}),
               search.createColumn({name: "name",join: "file",sort: search.Sort.ASC}),
               search.createColumn({name: "url",join: "file"}),
            ]
         });
         var url = null;
         var searchResultCount = folderSearchObj.runPaged().count;
         log.debug("folderSearchObj result count",searchResultCount);
         folderSearchObj.run().each(function(result){
            // first result should have the most recent file cause of the DESC sort , so return false to get out after 1 
            url = result.getValue({name: "url",join:"file"});
            fileName = result.getValue({name: "name",join:"file"});
            return false;
         });
        var result = url ? {success : true, filename : fileName, fileurl : url } :  {success : false, filename  : "", fileurl : "" }; 
        return result; 

    }
return {
     get: _get,
     delete: _delete,
     post: _post,
     put: _put
 };
});
