/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record','N/runtime','N/file'],

    function(record,runtime,file) {
        function getInputData() {
            try{
                var fileId = runtime.getCurrentScript().getParameter('custscript_mb_delete_file_id'); 
                log.debug('fileId',fileId);
                var csvFile = file.load({id:fileId});

                var contents = csvFile.getContents();
                var newLineChar = get_new_line_char(contents);
                log.debug('newLineChar',newLineChar);
                var lines = contents.split(newLineChar);
                log.debug('count lines',lines.length);

                var headers = lines[0].split(',');
                var inputData = new Array();

                for (var i = 1;i<lines.length;i++){
                    var values = lines[i].split(',');
                    var obj = new Object();
                    obj.rowId = i;

                    for (var j=0;j<headers.length;j++){
                        obj[headers[j]] = values[j];
                    };
                    log.debug('obj',JSON.stringify(obj));
                    inputData.push(obj)
                }
                log.debug('inputData length',inputData.length);

                return inputData

            }catch(e){
                log.error("error in getInput data",JSON.stringify(e))
            }   
        }
        const recordType = runtime.getCurrentScript().getParameter('custscript_mb_delete_record_type');
        function map(context) {
            // var recordType 
            // log.debug('recordType',recordType);
            log.audit("context in map",context)
            try{
                var rowData = JSON.parse(context.value);
                try{
                    if(rowData.internalId!=''){
                        var recToDelete = record.delete({
                            type : recordType,
                            id : rowData.internalId
                        });
                        // recToDelete.delete();
                        context.write({
                            key : context.key,
                            value : {deletedRec : recToDelete,status:'success',error:null}
                        });
                    }
                } catch(err){
                    log.error('err in map deleting record',err);
                    context.write({
                        key : context.key,
                        value : {deletedRec : rowData.internalId,status:'failure',error:err.message}
                    });
                }
            } catch(err){
                log.error('error in map step',JSON.stringify(err));
                return null;
            }

        }
/*
        function reduce(context) {
            try{
                log.debug('context in reduce',context);

                context.write({
                    key: context.key,
                    value: ''
                });

            }catch(e){
                log.error('error in key: '+context.key, e);
            }
        }
*/
        function summarize(context) {
            try{
                log.audit({
                    title: 'Usage units consumed',
                    details: context.usage
                });
                log.audit({
                    title: 'Concurrency',
                    details: context.concurrency
                });
                log.audit({
                    title: 'Number of yields',
                    details: context.yields
                });
                var contents = 'key,internalId,status,error'+'\n';
                context.output.iterator().each(function(key, value) {
                    contents += (key + ',' + value + '\n');
                    return true;
                });
                var d = new Date();
                var month = d.getMonth()+1;
                var day   = d.getDate();
                var hour = d.getHours();
                var minutes = d.getMinutes();
                var seconds = d.getSeconds();
                // Create the output file
                //
                // Update the name parameter to use the file name of the output file
                var fileObj = file.create({
                    name: (d.getFullYear()).toString() + (month>9 ? month : '0'+month).toString() + (day >9 ? day : '0'+day).toString()+hour.toString()+minutes.toString()+seconds.toString()+'RecordDeletionResults.CSV',
                    fileType: file.Type.CSV,
                    contents: contents
                });
        
                // Specify the folder location of the output file, and save the file
                //
                // Update the fileObj.folder property with the ID of the folder in
                // the file cabinet that contains the output file
                fileObj.folder ='741' ;
                fileObj.save();

                context.reduceSummary.errors.iterator().each(function (key, error, executionNo){
                    log.error({
                        title:  'Reduce error for key: ' + key + ', execution no  ' + executionNo,
                        details: error
                    });
                    return true;
                });

            }catch(e){
                log.error("error in summary data",e)
            }

        };

        function get_new_line_char(csv_str) {
            if (csv_str.indexOf('\r\n') > -1) {
                return '\r\n';
            } else {
                return '\n'
            }
        }

	return {

		config:{
			retryCount: 3,
			exitOnError: false
		},


		getInputData: getInputData,
		map: map,
		// reduce: reduce,
		summarize: summarize
	};

});