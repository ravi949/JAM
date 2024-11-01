/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/email', 'N/runtime', 'N/error'],
    function(search, record, email, runtime, error)
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
            
            log.debug("input error",JSON.stringify(summary.inputSummary));
            log.debug("map error",JSON.stringify(summary.mapSummary));
            log.debug("reduce error",JSON.stringify(summary.reduceSummary));
            
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
                    name: 'Store Fees Delete Failed',
                    message: JSON.stringify(errorMsg)
                });
                handleErrorAndSendNotification(e, stage);
            }
        }

        function createSummaryRecord(summary)
        {
            try
            {
                var seconds = summary.seconds;
                var usage = summary.usage;
                var yields = summary.yields;

                var rec = record.create({
                    type: 'customrecord_mb_summary',
                });

                rec.setValue({
                    fieldId : 'name',
                    value: 'Summary for M/R script: ' + runtime.getCurrentScript().id
                });

                rec.setValue({
                    fieldId: 'custrecord_time',
                    value: seconds
                });
                rec.setValue({
                    fieldId: 'custrecord_usage',
                    value: usage
                });
                rec.setValue({
                    fieldId: 'custrecord_yields',
                    value: yields
                });

                rec.save();
            }
            catch(e)
            {
                handleErrorAndSendNotification(e, 'summarize');
            }
        }

        function getInputData()
        {
        	try{
            	var batchId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_invoice_fees_batch'});
                log.debug(batchId);
            	oSearch = new Object();
            	oSearch.type ='customrecord_mb_invoice_fees';
            	oSearch.filters = [
            	         	       ['custrecord_mb_batch', search.Operator.IS, batchId],'and',
            	         	       ['custrecord_mb_invoice_fee_actual',search.Operator.IS,'T']
            	         	      ] ;
            	oSearch.columns = [
        	                   	search.createColumn({name: 'custrecord_mb_batch'}),
            	                   ];
            	
            	return search.create(oSearch);
        	}
        	catch(e){
        		log.error("Error",JSON.stringify(e));
        	}
        }

        function map(context)
        {
            var searchResult = JSON.parse(context.value);
            var feeId = searchResult.id;
            context.write(feeId);

            var olog = 	{title: 'map context',details: context};
            log.debug(olog);
        }

        function reduce(context)
        {
            var olog = {title: 'reduce context',details: context};
            log.debug(olog);

            var feeId = context.key;
            var internalId = feeId;
            if(internalId){
            	var featureRecord = record.delete({
      	       			type: 'customrecord_mb_invoice_fees',
         	       		id: internalId,
         	       		isDynamic: true
            	   });
        	};
        }

        function summarize(summary)
        {
            handleErrorIfAny(summary);
            createSummaryRecord(summary);
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
