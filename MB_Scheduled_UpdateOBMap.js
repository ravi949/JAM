/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

 define(
    [
        'N/email',
        'N/error',
        'N/record',
        'N/runtime',
        'N/search',
        './lib/MBErrorHandler.js',
        './lib/MBHelpers.js',
        './lib/MBFormatFunctions.js'
    ],

    function (email, error, record, runtime, search, mberror, mbhelp, mbformat) {

        const EMAIL_FROM_DEFAULT = 17;
        const OB_MAP_TABLE = "customrecord_mb_map_field"; 
        /**
         * Definition of the Scheduled script trigger point.
         * 
         * @param {Object}
         *            scriptContext
         * @param {string}
         *            scriptContext.type - The context in which the script
         *            is executed. It is one of the values from the
         *            scriptContext.InvocationType enum.
         * @Since 2015.2
         */

        function execute(scriptContext) {

            try {
                var anErrorOccurred = false; 
                var respText = "An update to the outbound maps was done on "+ new Date() + "<br><br>";                
                var masterOBListId = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_master_ob_list' });

                var masterOBList = getOutBoundMap(masterOBListId);  
                if (!masterOBList)
                    throw error.create({name: 'Parameter error ',message: "Invalid or Missing Master OB List"});

                var activeMaps = getActiveMaps(masterOBListId); 
                activeMaps.forEach(function (obMapId){
                    var obMap = getOutBoundMap(obMapId);
                    log.debug("Checking OBmapId ## map length",obMapId + "##"+ obMap.length);                                        
                    // search obMap for missing fields , update the ordinal when you find one. 
                    masterOBList.forEach(function (fieldData){
                        log.debug("checking fieldData ",JSON.stringify(fieldData));                        
                        var fieldIndex = obMap.map(function (el) { return el.fieldId; }).indexOf(fieldData.fieldId);
                        log.debug("fieldindex",fieldIndex); 
                        if(fieldIndex < 0){
                            fieldData.internalId = "0";
                            obMap.push(fieldData);
                            log.debug("pushing ", JSON.stringify(fieldData))
                        }else{
                            if(obMap[fieldIndex].ordinal != fieldData.ordinal){
                                obMap[fieldIndex].ordinal = fieldData.ordinal;
                                log.debug("updating ", JSON.stringify(fieldData))
                            }
                            else{
                                fieldData.internalId = "";
                                log.debug("nothing to update ")
                            }
                        }
                    });
                    
                    var obMapIndex = 0; 
                    obMap.forEach(function (fieldData){
                        log.debug("checking to remove fieldData ",JSON.stringify(fieldData));
                        var fieldIndex = masterOBList.map(function (el) { return el.fieldId; }).indexOf(fieldData.fieldId);
                        log.debug("remove fieldindex",fieldIndex);                         
                        if(fieldIndex < 0){
                            log.debug("removing", JSON.stringify(fieldData));
                            fieldData.isDelete = true; 
                            obMap = obMap.splice(obMapIndex,1);
                        }
                        else{
                            log.debug("nothing to remove ")
                        }

                        obMapIndex++; 
                    });

                    var hasErrors = updateOBList(obMap,obMapId);
                    if(hasErrors) anErrorOccurred = true;  
                });
            }            
            catch (err) {
                log.error("Error",JSON.stringify(err));
                anErrorOccurred = true; 
                respText += err.message + "<br><br>";
            }
            finally{
                respText += "<br><br>There were " + ( anErrorOccurred ? "some errors. Please consult the logs." : "no errors.  ") ; 
                log.debug("respText",respText);
                sendNotification(respText);

            }
        }

        function updateOBList(obMap,obMapId) {
            var hasErrors = false; 
            var recordId = null; 
            var result = {recordId:  0 , message: ""};
            log.debug("Updating OBmapId",obMapId);

            obMap.forEach(function (fieldData){
                try{
                    log.debug("updating fieldData ",JSON.stringify(fieldData));
                    if(fieldData.isDelete){
                        log.debug("removed","removed " + fieldData.fieldName);                        
                        recordId = record.delete({type: OB_MAP_TABLE,id: fieldData.internalId});
                    }
                    else{
                        if(fieldData.internalId == "0"){
                            // create record
                            log.debug("adding", fieldData.fieldName);                        
                            var obMapRcd = record.create({type: OB_MAP_TABLE,isDynamic: true});
                            obMapRcd.setValue({fieldId: "custrecord_mb_map_header", value: obMapId});              
                            obMapRcd.setValue({fieldId: "custrecord_mb_map_field",  value: fieldData.fieldId});  
                            obMapRcd.setValue({fieldId: "custrecord_mb_map_ordinal",value: fieldData.ordinal});      
                            recordId = obMapRcd.save();
                        }
                        else{
                            if(fieldData.internalId !=""){
                                log.debug("updating", fieldData.fieldName);                                                    
                                var obMapRcd = record.load({type: OB_MAP_TABLE,id: fieldData.internalId, isDynamic: true,})
                                obMapRcd.setValue({fieldId: "custrecord_mb_map_field",  value: fieldData.fieldId});  
                                obMapRcd.setValue({fieldId: "custrecord_mb_map_ordinal",value: fieldData.ordinal});  
                                recordId = obMapRcd.save();
                            }
                        }
                    }
                }catch(err){
                    log.error("Error during update OB List for recordId " + recordId ,err.message);
                    hasErrors = true; 
                }
            });
            return hasErrors; 
        }


        function getActiveMaps(mapId) {
            var activeMaps = new Array(); 
            var searchFilters = [
                search.createFilter({ name: "isinactive", operator: search.Operator.IS, values: "F" }),
                search.createFilter({ name: "internalid", operator: search.Operator.NONEOF, values: mapId})];
            
            var mapsToUpdate = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_maps_to_update' });

            if(mapsToUpdate){ 
                var arMapsToUpdate = mapsToUpdate.split(",");
                log.audit('armaps'+ typeof arMapsToUpdate ,arMapsToUpdate.length)
                searchFilters.push(search.createFilter({ name: "internalid", operator: search.Operator.ANYOF, values: arMapsToUpdate}));
            }

             var customrecord_mb_map_headerSearchObj = search.create({
                type: "customrecord_mb_map_header",
                filters: searchFilters,
                columns:[search.createColumn({name: "name",sort: search.Sort.ASC})]
             });

             var searchResultCount = customrecord_mb_map_headerSearchObj.runPaged().count;
             log.debug("customrecord_mb_map_headerSearchObj result count",searchResultCount);

             customrecord_mb_map_headerSearchObj.run().each(function(result){
                activeMaps.push(result.id);
                return true;
             });
             
            return activeMaps; 
        }

        
        function getOutBoundMap(mapId) {

            var outBoundMap = new Array(); 

            var customrecord_mb_map_fieldSearchObj = search.create({
                type: OB_MAP_TABLE,
                filters:[
                    search.createFilter({ name: "custrecord_mb_map_header", operator: search.Operator.ANYOF, values: mapId }),
                    search.createFilter({ name: "isinactive", operator: search.Operator.IS, values: "F" })
                ],
                columns: [
                    search.createColumn({name: "custrecord_mb_map_field"}),
                    search.createColumn({name: "custrecord_mb_map_ordinal",sort: search.Sort.ASC})
                ]
            });
            var searchResultCount = customrecord_mb_map_fieldSearchObj.runPaged().count;

            log.debug("customrecord_mb_map_fieldSearchObj result count",searchResultCount);
            var arIndex = 1; 
            customrecord_mb_map_fieldSearchObj.run().each(function(result){
                outBoundMap.push({ 
                    internalId :    result.id,
                    fieldId :       result.getValue({ name: 'custrecord_mb_map_field'}),
                    fieldName:      result.getText( { name: 'custrecord_mb_map_field'}),
                    ordinal :       arIndex,
                    isDelete :      false
                });
                arIndex++; 
                return true;
             });
             
            return outBoundMap; 
        }
        

        function sendNotification(respText) {
            var author = EMAIL_FROM_DEFAULT;

            var recipients = runtime.getCurrentScript().getParameter({name:'custscript_mb_user_updateobmap'});
            log.debug("userid current##author",recipients+"##"+author); 

            var subject = "Outbound Map Update Completion";
            if (recipients) {
                email.send({
                    author: author,
                    recipients: recipients,
                    subject: subject,
                    cc: ['netsuite@mibar.net'],
                    body: respText
                });                
            } else {
                log.error("No userId to send mail to");
            }
        }

        return {
            execute: execute
        };

    });