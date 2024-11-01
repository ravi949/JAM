/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 */
define(['N/search',
        'N/record',
        'N/email',
        'N/runtime',
        'N/error',
        './lib/MBHelpers.js',
        './lib/MBFormatFunctions.js',
        './lib/MBErrorHandler.js',
        ],
    function(search, record, email, runtime, error,mbhelp,mbformat,mberror)
    {
        function handleErrorAndSendNotification(e, stage)
        {
            log.error('Stage: ' + stage + ' failed', e);

            var author = -5;
            var recipients = 'rcm@mibar.net';
            var subject = 'Map/Reduce script ' + runtime.getCurrentScript().id + ' failed for stage: ' + stage;
            var body = 'An error occurred with the following information:\n' +
                       'Error code: ' + e.name + '\n' +
                       'Error msg: ' + e.message;

            email.send({
                author: author,
                recipients: recipients,
                subject: subject,
                body: body
            });
        }

        function handleErrorIfAny(summary)
        {
            var inputSummary = summary.inputSummary;
            var mapSummary = summary.mapSummary;
            var reduceSummary = summary.reduceSummary;
                       
            if (inputSummary.error)
            {
                var e = error.create({
                    name: 'INPUT_STAGE_FAILED',
                    message: inputSummary.error
                });
                handleErrorAndSendNotification(e, 'getInputData');
            }

            handleErrorInStage('map', mapSummary);
            handleErrorInStage('reduce', reduceSummary);
        }

        function handleErrorInStage(stage, summary)
        {
            var errorMsg = [];
            summary.errors.iterator().each(function(key, value){
                var msg = 'Stage Failure: ' + key + '. Error was: ' + JSON.parse(value).message + '\n';
                errorMsg.push(msg);
                return true;
            });
            if (errorMsg.length > 0)
            {
                var e = error.create({
                    name: runtime.getCurrentScript().id,
                    message: JSON.stringify(errorMsg)
                });
                handleErrorAndSendNotification(e, stage);
            }
        }


        function getInputData()
        {
        	log.debug("start");
        	try{
        		var tranSearch = search.load({
            	        id: 'customsearch242'
            	    });
        		return tranSearch;
        	}
        	catch(e){
        		log.error("Error",JSON.stringify(e));
        	}
        }

        function map(context)
        {
            var olog = 	{title: 'map context',details: context};
            var searchResult =JSON.parse(context.value);
            log.debug(olog);
            
            var key = searchResult.values["GROUP(internalid)"].value;
            log.debug("key",key);
            context.write(key);
        }

        function reduce(context)
        {
//            var olog = {title: 'reduce context',details: context};
//            log.debug(olog);

        	var invoiceId = context.key;
            log.debug("invoice id ",invoiceId);

        	if(invoiceId){
          		var tranRcd = record.load({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    isDynamic: true
          		});
        		if(tranRcd){

			        var subList =  'item';
                    var lineCount = tranRcd.getLineCount(subList);
                    for (var j = 0; j < lineCount; j++)
                    {
                    	/*
                    	tranRcd.setSublistValue({
                            sublistId: subList,
                            fieldId: 'custcol_mb_tax_amount',
                            line: j,
                            value: 0
                        });
*/
                    	var itemType  = tranRcd.getSublistValue({
                            sublistId: subList,
                            fieldId: 'itemtype',
                            line:j
                        });
                        log.debug("key",itemType);
                        
                    	if(itemType != "InvtPart" && itemType != "NonInvtPart") continue;
                    	
                    	var itemRcd = tranRcd.selectLine({sublistId: subList,line: j});
    			        if(itemRcd){
        		            tranRcd.setCurrentSublistValue({
        		                sublistId: subList,
        		                fieldId: "custcol_mb_tax_amount",
        		                value : 0
        		        	});
        		        }
        		        tranRcd.commitLine({sublistId: subList});

                    }
			    	tranRcd.save();
        		}
        	}
        }
        
        function summarize(summary)
        {
            handleErrorIfAny(summary);

        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize,
            // The exitOnError setting is optional. If excluded,
            // it defaults to false.
            config:{
                exitOnError: true
            }
        };
    });
