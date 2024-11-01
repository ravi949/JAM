/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

const VALIDATION_LIMIT = 10;			// once its been validated 10 times stop trying.
const COUNT_NA = 93;
const COUNT_GIVEUP = 95;
const COUNT_SUCCESS = 99;


const MINIMUM_USAGE = 300;
var startDateTime = new Date();

var EMAIL_FROM_DEFAULT = 2254;

define(
		[
		  'N/email',
		  'N/error',
		  'N/https',
		  'N/record',
		  'N/render',
		  'N/runtime',
		  'N/search',
		  'N/task',
		  'N/url',
		  './lib/MBHelpers.js',
	      './lib/MBErrorHandler.js',
	      './lib/MBFormatFunctions.js'
		],
		function(email, error, https, record, render, runtime, search, task, url, mbhelp, mberror, mbformat) {
					
						
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
				try{
			    	executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
			    	
    				var searchResults = runSearch();
    				
    				if (searchResults) {
    				    var srchIdx = 0; var goodCount = 0; var badCount = 0; var testCount = 0;
    				    var getOut = false;
    				    do {
    				        var resultSlc = searchResults.getRange({
    				            start : srchIdx,
    				            end : srchIdx + 1000
    				        });        //Retrieve results in 1000-row slices.

    				        for (var i in resultSlc) {                                //Step through the result rows.
    				        	var transactionId =  resultSlc[i].id;                //Get Result record internal Id
    							var transactionType = resultSlc[i].recordType;        //Get Result record type
    							log.debug(transactionType,transactionId);
    							
    							var customerId = resultSlc[i].getValue({
    								name : "custrecord_mb_store_customer",
    								join : "CUSTRECORD_MB_STORE_DEPOSIT_LINK"
    							});
     
    							// Increment the validation count
    							var newCount = mbformat.parseIntOrZero(resultSlc[i].getValue({name : 'custrecord_mb_rav_count'})) +1;
    							var badInvoices = new Array();
    							if(customerUsesFees(customerId)){
    								badInvoices = validateEstimatedFees(resultSlc[i]);
    								// TODO: turn array into CSV and attach to email
    								if (badInvoices.length>0){
    									testCount ++;
    									log.audit("badInvoices",JSON.stringify(badInvoices));
    								}
    								// badinvoices.length = 0
    								else{
    									newCount = COUNT_SUCCESS;
    									log.debug("success",transactionId);
    								}
    							}
    							else{
    								newCount = COUNT_NA;		 // set to not applicable so it can proceed with RA creation.
    							};
    							
    							// when its reached the limit stop trying
    							newCount = newCount == VALIDATION_LIMIT + 1 ? newCount = COUNT_GIVEUP : newCount;
    							
    							if(newCount == COUNT_NA){
        							record.submitFields({
        				                type: transactionType,
        				                id : transactionId,
        				                values : { custrecord_mb_rav_count : newCount}
        				            });
        							log.debug("updated DAP","updated DAP");
    							}
    							srchIdx++;
    							if(badInvoices.length ==0) goodCount++ ; else badCount++;
    							if(testCount>10) throw "Test exit";

    							if(executionTimesUp()){
    	                         	log.audit("Time limit error ","Validation has been rescheduled to avoid a script timeout");
    	                        	getOut = true; break;
    	                        }
    	                        var scriptObj = runtime.getCurrentScript();
    	                        log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());

    	                        if(scriptObj.getRemainingUsage() < MINIMUM_USAGE){
    	                         	log.audit("Rescheduled","Validation has been rescheduled to avoid a script usage error");
    	                         	getOut = true; break;
    	                        }
    							
    				        }
    				    } while (resultSlc.length >= 1000);
    				    if(goodCount+badCount != 0){
            				if(!getOut){
                				var respText = "Open RAs have been validated . ";
                				respText +='<br>There were ~1 deposits processed.'.replace('~1',goodCount.toString());
                				if(badCount!=0)
                					respText += "<br>Please note: ~2 deposits failed validation. ".replace('~2',badCount.toString());
            //    		    	sendNotification(respText);
            				}
            				else{
            					scheduleRestart();
            				}
    				    }
    				}
    				else{
    					log.audit("No DAP records to validate");
    				}
    				
				}
				catch(err){
					log.error("Error",JSON.stringify(err));
				}
			}

			/**
			 * Validate Estimated Fees
			 * 
			 * @param {searchResult} searchResult
			 * @return {boolean}
			 */
			function validateEstimatedFees(searchResult) {
				var badInvoices = new Array();
				var batchId = searchResult.getValue({
				         name: "custrecord_mb_store_batch",
				         join: "CUSTRECORD_MB_STORE_DEPOSIT_LINK"
				});
				log.debug("batchId ",batchId);
				
				var depositId = searchResult.getValue({name : "custrecord_mb_deposit_id"});
				log.debug("depositId ",depositId );
				
				// get invoices from the store details for this deposit
				var invoices = getInvoices(batchId,depositId);
				var savInvoices = invoices.slice(0);
				
    			log.debug('1st vef invoices length is ', invoices.length );
				// get custom gl from customsearch_mb_rav_customgl_fees
				var customGlFees = getCustomGLFees(invoices);
    			log.debug('returned customgl Search Results length is ', customGlFees.length );
    			
				// get fees from s2
				var estimatedFees = getEstimatedFees(savInvoices);
				log.debug('returned estimated Search Results length is ', estimatedFees.length );
				
				// create an "index" to find invoices easy,
     	    	var estimatedInvoices = estimatedFees.map(
     	        		function (searchResult){
     	        			return searchResult.getValue(searchResult.columns[0]);
     	        		}
     	        );
     	    	log.debug('estimatedinvoices Search Results length is ', estimatedInvoices.length );
     	    	log.debug('estimatedinvoices Search Results ', JSON.stringify(estimatedInvoices));
     	    	
				// compare s1 to s2 and record bumps.
				customGlFees.forEach(
					function callback(result) {
	                    var cglInvoiceId = result.getValue(result.columns[0]);
                        var cglAmount = mbformat.parseFloatOrZero(result.getValue(result.columns[1]));
//                        log.debug(cglInvoiceId,cglAmount);
                        
                        // find if the invoice has an invoice fees record;
                        var index = estimatedInvoices.indexOf(cglInvoiceId);
                        log.debug("found index is ",index);
                        if(index >= 0){
                        	var estSearchResult = estimatedFees[index];
//                        	log.debug("estSearchResult",JSON.stringify(estSearchResult));
                        	var estInvoiceId = estSearchResult.getValue(result.columns[0]);
                        	var estAmount = mbformat.parseFloatOrZero(estSearchResult.getValue(estSearchResult.columns[1]));
                        	if(cglAmount != estAmount){
//                            	log.debug("amount difference   "+estInvoiceId ,cglAmount.toString() + "        "+estAmount.toString());
                        		badInvoices.push(
                        			{invoice: cglInvoiceId,cglAmount: cglAmount, estAmount: estAmount,reason: "amount"}
                        		);
                        	}
                        }
                        // no fees record
                        else{
                    		badInvoices.push(
                        			{invoice: cglInvoiceId,cglAmount: cglAmount, estAmount: estAmount, reason: "missing"}
                    		);
                        }
					}
				);
				
				return badInvoices ;
			}
					
			
			
	        //
	        // return an array of invoices paid off in this batch, new code filters here cause NS cant filter it w/o a timeout
	        //
	        function getInvoices(batchId,depositId){

	         	var invoices = new Array();

	         	var invoiceSearch = search.load({
        	        id: 'customsearch_mb_search_accrual_invoice_2'
        	    });

        		if (!mbhelp.isEmpty(batchId)){
		        	log.debug("batchId",batchId);
		    		var batchFilter = search.createFilter({ name :"custrecord_mb_store_dtl_batch",
		    			 operator : search.Operator.IS,
		    			 values : batchId
		    		});
		    		invoiceSearch.filters.push(batchFilter);
		        };
        		
        		var searchResults  = searchGetAllResultSrchObj(invoiceSearch,{isLimitedResult: false });
				
        		if (searchResults.length > 0) {
        			log.debug('getinvoices Search Results length is ', searchResults.length );
	     	    	invoices = searchResults.map(
	     	        		function (searchResult){
//	     	        			log.debug("deposit",searchResult.getValue(searchResult.columns[2]));
	     	        			if(searchResult.getValue(searchResult.columns[2]) == depositId &&
	     	        			   searchResult.getValue({name : "custrecord_mb_store_detail_invoice"}) !=null){
	     	        				return searchResult.getValue({name : "custrecord_mb_store_detail_invoice"});
	     	        			}
	     	        			
	     	        		}
	     	        );
	     	    	log.debug("Invoices array count", invoices.length);
//	     	    	log.debug("Invoices array ", JSON.stringify(invoices));
	     	    	var paidInvoices = invoices.filter(function(item, index){
	     	    			return (invoices.indexOf(item) >= index && item !=null);
	     	    	});
	     	    	log.debug("paidInvoices  length", paidInvoices.length);
	     	    	
	             }
	             return paidInvoices;
	        }
	        
	        //
	        // return an array of invoices along with the fees from the custom GL records.
	        //
	        function getCustomGLFees(invoices){
		        var customGLFees = new Array();

	         	var invoiceSearch = search.load({
        	        id: "customsearch_mb_rav_customgl_fees"
        	    });

	         	var invoiceChunks = convertArrayIntoChunks(invoices, 3500);
//    			log.debug('invoiceChunks length is ', invoiceChunks.length );
	         	invoiceChunks.forEach(
						function(invoiceList){
//			    			log.debug('invoice list length is ', invoiceList.length );
			        		if (!mbhelp.isEmpty(invoiceList)){
					        	log.debug("invoices",JSON.stringify(invoiceList));
					    		var invoiceFilter = search.createFilter({ name :"internalid",
					    			 operator : search.Operator.ANYOF,
					    			 values : invoiceList
					    		});
					    		invoiceSearch.filters.push(invoiceFilter);
					        };
			        		
			        		var searchResults  = searchGetAllResultSrchObj(invoiceSearch,{isLimitedResult: false });
							
			        		if (searchResults.length > 0) {
//			        			log.debug('loop Search Results length is ', searchResults.length );
			        			customGLFees = customGLFees.concat(searchResults);
			        			log.debug('loop customgl length is ', customGLFees.length );
				            }
						}
	         	);
    			log.debug(' final customgl Search Results length is ', customGLFees.length );
	            return customGLFees;
	        }
	        
	        //
	        // return an array of invoices along with the estimate fees .
	        //
	        function getEstimatedFees(invoices){
		        var estimatedFees = new Array();

	         	var invoiceSearch = search.load({
        	        id: "customsearch_mb_tra_ra_validator"
        	    });
    			log.debug('invoice length is ', invoices.length);
	         	var invoiceChunks = convertArrayIntoChunks(invoices, 3500);
    			log.debug('invoiceChunks length is ', invoiceChunks.length);
	         	invoiceChunks.forEach(
						function(invoiceList){
			        		if (!mbhelp.isEmpty(invoiceList)){
					    		var invoiceFilter = search.createFilter({
					    			name :"internalid",
					    			operator : search.Operator.ANYOF,
					    			values : invoiceList
					    		});
					    		invoiceSearch.filters.push(invoiceFilter);
					        };
			        		
			        		var searchResults  = searchGetAllResultSrchObj(invoiceSearch,{isLimitedResult: false });
		        			log.debug('loop est Search Results length is ', searchResults.length );
		        			
			        		if (searchResults.length > 0) {
			        			log.debug('Estimated Fees Search Results length is ', searchResults.length );
			        			estimatedFees = estimatedFees.concat(searchResults);
				            }
		        			log.debug('loop estimatedFees length is ', estimatedFees.length );

						}
	         	);
	            return estimatedFees;
	        }
	        
			//  return true if a customer uses fees by
			//  checking the distribution table for a record with the invoice payment type.
			//
			function customerUsesFees(customerId){
				var usesFees = false;

				log.debug("customerId",customerId);
	        	var oSearch = new Object();
        		oSearch.isLimitedResult = true;
	        	oSearch.type = "customrecord_mb_cash_distribution_setup";
	        	oSearch.filters = [
             	     search.createFilter({
             	    	 name : "custrecord_mb_setup_dist_linefee_txn_typ",
        				 operator : search.Operator.ANYOF,
        	             values : "7"							// "Invoice"
        	         }),
             	     search.createFilter({
             	    	 name : "custrecord_mb_setup_dist_customer",
             	    	 operator : search.Operator.ANYOF,
    	               	 values : customerId
    	             }),
             	     search.createFilter({
             	    	 name : "isinactive",
             	    	 operator : search.Operator.IS,
    	               	 values : "F"
    	             }),
    	        ];
	        	
	        	oSearch.columns = [
                    search.createColumn({name: "internalid"})
                ];

	        	var searchResult = searchGetAllResult(oSearch);
				if(searchResult.length >0) usesFees = true;
							
				return usesFees;
				
            }
			
			function runSearch(){
        		
        		var searchId = runtime.getCurrentScript().getParameter({name:'custscript_mb_rav_search'});
        		if(!searchId){
                    mberror.prettyError(' Scheduled Script Error',
                    		"The search (~1) does not exist".replace("~1",searchId));
        		}
				var searchObj = search.load({                        //Load Search by scriptId.
			        id : searchId,
			    });
		
				var searchResults = searchObj.run();                    //Execute Search.
	            return searchResults;
            }
			


			
		    function sendNotification(respText){
		        var author = EMAIL_FROM_DEFAULT;
				var userId = runtime.getCurrentScript().getParameter({name:'custscript_mb_user_ra'});
		        var author = userId;
		        var recipients = userId;
		        var subject = "RA Validations";
		        var body = respText;

		        email.send({
		            author: author,
		            recipients: recipients,
		            subject: subject,
		            cc : ['netsuite@mibar.net'],
		            body: body
		        });

		    }

			function scheduleRestart(){
				var userId = runtime.getCurrentScript().getParameter({name:'custscript_mb_user_ra'});
				
		        var taskScript = {scriptId : 'customscript_mb_scheduled_ra_validator',
		            	deploymentId : 'customdeploy_mb_scheduled_ra_validator',
		            	mrParams : {
		            				 custscript_mb_user_ra: userId
		            				}
		    	};

		        var mrTask = task.create({
		            taskType: task.TaskType.SCHEDULED_SCRIPT,
		            scriptId: taskScript.scriptId,
		            params: taskScript.mrParams
		        });
		        var mrTaskId = mrTask.submit();
		        
		        log.debug("tsk id",mrTaskId);
		        
			}

			function executionTimesUp(){
		    	var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
		    	var minutesRunning = Math.floor((timeElapsed/1000)/60);
		    	return (minutesRunning >executionThreshold);
		    	
		    }
		    
	        //=================
	        /**
	         * this will get all result more than 1000
	         * @param option: save search Option
	         * @param option.isLimitedResult
	         * @return {result[]}
	         */
	        function searchGetAllResult(option){
	            var result = [];
	            if(option.isLimitedResult == true){
	                var rs = search.create(option).run();
	                result = rs.getRange(0,1000);
	                
	                return result;
	            }
	            
	            var rp = search.create(option).runPaged();
	            rp.pageRanges.forEach(function(pageRange){
	                var myPage = rp.fetch({index: pageRange.index});
	                result = result.concat(myPage.data);
	            });
	            
	            return result;
	        }
	        
	        /**
	         * this will get all result more than 1000
	         * @param option: save search Option
	         * @param option.isLimitedResult
	         * @return {result[]}
	         */
	        function searchGetAllResultSrchObj(searchObject,option){
	            
	            if(mbhelp.isEmpty(option)){
	                option = {};
	            }
	            
	            var result = [];
	            if(option.isLimitedResult == true){
	                var rs = searchObject.run();
	                result = rs.getRange(0,1000)
	                
	                return result;
	            }
	            
	            var rp = searchObject.runPaged();
	            rp.pageRanges.forEach(function(pageRange){
	                var myPage = rp.fetch({index: pageRange.index});
	                result = result.concat(myPage.data);
	            });
	            
	            return result;
	        }
	        
	        
	        /**
	         * this function will sort the search result by ASC
	         * @param result array(search result)
	         * @param field string(name of the field to sort)
	         */
	        function searchSortResult(result,field){
	            if(mbhelp.isEmpty(result) || mbhelp.isEmpty(field)){
	                return [];
	            }
	            
	            var arrResult = result.sort(function(a,b){
	                var inta = a.getValue(field);
	                var intb = b.getValue(field);
	                return inta - intb;
	            });
	            
	            return arrResult;
	        }
	        
			/**
			 * Function divide Array into chunks
			 * 
			 * @param {array} inputArray
			 * @param {integer} chunkSize
			 * @return {array}
			 */
			function convertArrayIntoChunks(inputArray, chunkSize) {
				var outputArray = [];
				while (inputArray.length > 0) {
					outputArray.push(inputArray.splice(0, chunkSize));
				}

				return outputArray;
			}
			
	       		    
			return {
				execute : execute
			};

		});