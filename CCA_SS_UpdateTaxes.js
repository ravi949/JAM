/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

var EMAIL_FROM_DEFAULT = 51;

define(
    [
        'N/email',
        'N/record',
        'N/runtime',
        'N/search',
        'N/task',
        './lib/MBFormatFunctions.js',
        './lib/MBHelpers.js'        
    ],
    (email, record, runtime, search, task, mbformat, mbhelp) => {
        const MINIMUM_USAGE = 300;
        const executionThreshold = 55;
        const startDateTime = new Date();
        const THIS_SCHEDULED_SCRIPT = "customscript_cca_ss_amazon_tax_adjust";
        
        /**
         * Definition of the Scheduled script trigger point.
         * 
         * @param {Object}
         *            scriptContext
         * @param {string}
         *            scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */

        const execute = (scriptContext) => {
            try {
                var updateResults = getBadOrders();
                if(updateResults.incomplete) scheduleRestart(); 
                // var goodCount = updateResults.goodCount;
                // var badCount = updateResults.badCount;
                // if (badCount != 0) {
                //     var respText = "COGS Accrual CT Build results. ";
                //     respText += '<br>There were ~1 accrual custom transactions built.'.replace('~1', goodCount.toString());
                //     if (badCount != 0)
                //         respText += "<br>Please note: ~2 transactions could not be processed due to errors. ".replace('~2', badCount.toString());
                //     //sendNotification(respText);
                // }
            }
            catch (err) {
                throw err;
            }
        }

        const getBadOrders = () => {

            const scriptObj = runtime.getCurrentScript();            

            const statList = new Array();
            let srchIdx = 0;
            const runStats = {
                incomplete: false,
                goodCount: 0,
                badCount: 0
            }

            let oResp = new Object(); 
            const searchResults = runSearch();
            if (searchResults) {
                do {
                    resultSlc = searchResults.getRange({
                        start: srchIdx,
                        end: srchIdx + 1000
                    });        // Retrieve results in 1000-row slices.
                    for (var i in resultSlc) {                                //Step through the result rows.
                        let result = resultSlc[i]; 
                        let subList= "item"; 

                        log.debug("processing record ", result.id);
                        var transactionRcd = record.load({type: result.recordType,id: result.id, isDynamic: true})                        
                        let taxTotal = 0 ; 
                        let subTotal = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId: "subtotal" })); 
                        let shippingCost = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId: "shippingcost"})); 
                        let totalTaxable = subTotal + shippingCost; 

                        let amazonTax = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId: "custbody_mb_source_inv_tax_amount" }));                             
                        let taxRate = mbformat.roundVal(mbformat.roundVal((amazonTax*100)/totalTaxable,2),2); 
                        // let taxRate = mbformat.roundVal((amazonTax / (totalTaxable - amazonTax))*100,3);
                        log.debug("80 tax rate", taxRate); 
                        lineCount = transactionRcd.getLineCount(subList);
                        log.debug("75 linecount",lineCount);
                        for (var j = 0; j < lineCount; j++){
                            //	    log.debug("j",j);                       
                            transactionRcd.selectLine({sublistId: subList, line: j});
                            let lineItemAmount  = mbformat.parseFloatOrZero(transactionRcd.getCurrentSublistValue({ 
                                sublistId : subList, 
                                fieldId : 'amount'}));

                            taxTotal += (lineItemAmount * (taxRate/100)); 
                            log.debug("91 tax total", taxTotal); 
                            transactionRcd.setCurrentSublistValue({ 
                                sublistId : subList, 
                                fieldId : 'taxrate1', 
                                value : taxRate,
                                ignoreFieldChange: true });
                            transactionRcd.commitLine({sublistId: subList});    
                        }
                        transactionRcd.setValue({ 
                            fieldId: "shippingtax1rate", 
                            value: taxRate,
                            ignoreFieldChange: true });
                        
                        // transactionRcd.setValue({
                        //     fieldId: "taxtotal", 
                        //     value: taxTotal,
                        //     ignoreFieldChange: true });

                        transactionRcd.setValue({
                            fieldId: "custbody_cca_tax_adjustments", 
                            value: true,
                            ignoreFieldChange: true });
                                
                        transactionRcd.save();
                        var transactionRcd = record.load({type: result.recordType,id: result.id, isDynamic: true})                        
                        transactionRcd.save();                                                
                        runStats.goodCount++; 

                        log.audit(" 3 Remaining governance units: " + scriptObj.getRemainingUsage());                        
                        if (executionTimesUp()) {
                            log.debug({ title: 'TIME_LIMIT_CHECK', details: "Script stopped to avoid a script timeout" });
                            runStats.incomplete = true;
                            return runStats;
                        }
    
                        if (scriptObj.getRemainingUsage() < MINIMUM_USAGE) {
                            log.debug({ title: 'USAGE_CHECK', details: "Script stopped to avoid a script usage error" });
                            runStats.incomplete = true;                            
                            return runStats;                        
                        }    
                    }

                    srchIdx++;

                } while (resultSlc.length >= 1000);
            }

            return runStats;
        }

        /**
         *  runs a search of sales orders that have taxes that need to be adjusteed. 
         * @returns array of search results with internal ids to be retreived 
         */
        const runSearch = () => {
            var searchId = runtime.getCurrentScript().getParameter({ name: 'custscript_cca_search_taxorders' });
            if (!searchId) {
                log.error(' Scheduled Script Error',"The search (~1) does not exist".replace("~1", searchId));
                throw "The search (~1) does not exist".replace("~1", searchId);
            }
            var searchObj = search.load({id: searchId});

            // log.debug("search", JSON.stringify(searchObj));
            var searchResults = searchObj.run();                    // Execute Search.
            return searchResults;
        }

        const executionTimesUp  = () => {
            const timeElapsed = Math.abs((new Date()).getTime() - startDateTime.getTime());
            const minutesRunning = Math.floor((timeElapsed / 1000) / 60);
            return (minutesRunning > executionThreshold);

        }

        const scheduleRestart = () => {
            log.debug("scheduled it to restart");
                    
            var taskScript =    {scriptId :     THIS_SCHEDULED_SCRIPT,
                                // deploymentId : THIS_SCHEDULED_SCRIPT.replace("customscript","customdeploy") use next available
            };
            
            var mrTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: taskScript.scriptId
                // params: taskScript.mrParams
            });
            
            var mrTaskId = mrTask.submit();                    
            log.debug("tsk id",mrTaskId);                    
        }
             
        const sendNotification = (respText) => {
            var author = EMAIL_FROM_DEFAULT;
            var subject = "Consolidated PO Errors";
            var body = respText;

            email.send({
                author: author,
                recipients: 'netsuite@mibar.net',
                subject: subject,
                body: body
            });

            log.debug("mail sent", author);
        }

        return {execute: execute};

    });