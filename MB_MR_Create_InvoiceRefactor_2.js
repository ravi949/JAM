/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * 
 * 
 * https://4668299-sb1.app.netsuite.com/app/common/search/search.nl?cu=T&e=T&id=16735
 * * https://4668299-sb1.app.netsuite.com/app/common/search/search.nl?cu=T&e=T&id=16736  removed tj references
 */
define(['N/search', 'N/record','N/email','N/url','N/runtime','N/https','N/format','N/task','N/file'],

		function(search,record,email,url,runtime,https,format,task,file) {
			const oldsrchId = 12841;
			// const srchId = '15373'; // new test srch
			const dtcSrchId = '16735';
			const channelSrchId = '16736'
			const TAX_CODE = 334396;                  // 332165;
			const TAX_CODE_CA = 334606;
			const TAXJAR_EXEMPT = 3; 
			const BNC_TAX_CODE = 334397;
			const BNC_TAX_CODE_CA = 334603;
			//const test = true;
	function getInputData() {
		try{
			var srchId = runtime.getCurrentScript().getParameter('custscript_mb_invoices_to_create_id'); 
			/*var test = runtime.getCurrentScript().getParameter('custscript_mb_is_test') === 'true';
			log.debug('test',test);
			if(test){
				var testFilter = search.createFilter({
					name : 'internalid',
					operator : search.Operator.ANYOF,
					values : '16095257'
				})
				var srch = search.load({
					id : srchId
				});
				srch.filters.push(testFilter);
			} else {
				var srch = search.load({
					id : srchId
				});

			};

			var channelFilterId = runtime.getCurrentScript().getParameter('custscript_tss_mr_mb_channel_filter');

			if (channelFilterId!=='' && channelFilterId!=null && channelFilterId.length>0){
				log.debug("channelFilterId",channelFilterId)
				channelFilterId = channelFilterId? channelFilterId.split(','):channelFilterId;
				var filterValues = channelFilterId;//new Array();
				var channelFilter = search.createFilter({
					name : 'class',
					operator : search.Operator.ANYOF,
					values : filterValues
				});
				srch.filters.push(channelFilter)
			};
			// log.debug("srch",srch)
			// //  var searchResultCount = srch.runPaged().count;
			var results = searchGetResultObjects(srch);*/
			// log.audit("searchResultCount",results.length)
			return {
				type : 'search',
				id : srchId
			}

			//  return results;

		}catch(e){
			log.error("error in getInput data",JSON.stringify(e))
		}
	}

	function map(context) {
		log.audit("context in map",context)
		try{
			result = JSON.parse(context["value"]).values;
			// log.audit(result.columns);
			// log.audit(result);
		
			var soId = result["GROUP(createdfrom)"].value;
			log.debug('soId',soId);
			var newRecId   = result["MAX(internalid)"]; 
			log.debug('newRecId',newRecId);
			var ffTranDate = result["MAX(formuladate)"];
			log.debug('ffTranDate',ffTranDate);
			var actualShipCost = result["SUM(formulanumeric)"];
			var channel = result["GROUP(class)"].value; 
			var soSubtotal = result["MIN(formulanumeric)"];
			var taxProportion = result["MAX(formulanumeric)"];
			var soTranId = result["GROUP(formulatext)"];

			var object = {
				'soId' : soId,
				'newRecId' : newRecId,
				'ffTranDate' : ffTranDate,
				'actualShipCost' : actualShipCost,
				'soSubtotal' : soSubtotal,
				'channel' : channel,
				'taxProportion' : taxProportion,
				'soTranId'  : soTranId
			};

			log.audit('object'+context.key,JSON.stringify(object));

			context.write({
				key : context.key,
				value : object
			});

		} catch(err){
			log.error('error in map step',JSON.stringify(err));
			return null;
		}

	}

	function reduce(context) {
		log.debug('context in reduce',context);
		// try{
			// var soId = context.key;
			var arrayResults = context.values;
			var resultLength = arrayResults.length;
			log.audit('reduce result length for '+context.key,resultLength);
			for (x=0;x<arrayResults.length;x++){
				try{
					var result = JSON.parse(arrayResults[x]);
					
					log.audit('result in reduce', JSON.stringify(result));
					var newRecId = result.newRecId;
					var ffTranDate = result.ffTranDate;
					var actualShipCost = result.actualShipCost;
					var soSubtotal = result.soSubtotal;
					var _channel = result.channel;//result.channel; 
					var taxProportion = result.taxProportion;
					var soTranId = result.soTranId;
					var soId = result.soId;
					log.debug('soSubtotal',soSubtotal);

					log.debug('actualShipCost',actualShipCost);

					log.debug('ffTranDate',ffTranDate);

					var recordObj = record.transform({
						fromType : record.Type.SALES_ORDER,
						fromId : soId,
						toType : record.Type.INVOICE
					});

					var tranDate = getDateValue(new Date(ffTranDate));
					log.debug('tranDate',tranDate);
					recordObj.setValue({fieldId : "custbody_mb_linked_fulfil_id", value: newRecId});
					recordObj.setValue({fieldId : "trandate", value: tranDate});
					recordObj.setValue({fieldId : 'custbody_tss_shipping_confirmation_box',value: false});

					var invoice_entity= recordObj.getValue({fieldId: "entity"});
					var channel = recordObj.getValue({fieldId : 'class'});
					log.debug('channel',channel);
					// RCM Taxjar removal
					// if(invoice_entity!='53' && invoice_entity!= '3923' && channel!= '1' && channel!='16' && channel!='15' && channel!='57' && channel!='58' && channel!='66'){
					// 	recordObj.setValue({fieldId : 'custbody_tj_exempt_order',value: '1'})
					// } else if (invoice_entity=='53' || invoice_entity== '3923'|| channel== '10'){
					// 	recordObj.setValue({fieldId : 'custbody_tj_exempt_order', value : '3'});
					// };
					
					if (channel == '1' || channel == '58' || channel == '57' || channel == '66' || channel == 1 || channel == 58 || channel == 57 || channel == 66){
						var storeId = "INV";				
					} else {
						var storeId= recordObj.getText({fieldId: "entity"})
					};

					// added 11-2-2022 for TaxJar handling; updated 4/12

					// RCM Taxjar removal
					var taxTotal = parseFloat(recordObj.getValue({fieldId: "taxtotal"}));
					// var taxJarTaxTotal = recordObj.getValue({fieldId : 'custbody_tj_external_tax_amount'});

					// if(taxJarTaxTotal!='' || (channel!='15' && channel!='16')){
					// 	taxJarTaxTotal = parseFloat(taxJarTaxTotal);
					// } else {
					// 	taxJaxTaxTotal = 0;
					// }

					// if(taxTotal==0 && taxJarTaxTotal!=0){
					// 	taxTotal = taxJarTaxTotal
					// };

					// log.debug('taxTotal, taxJarTaxTotal',taxTotal+', '+taxJarTaxTotal);

					log.debug("tax total",taxTotal);
					var invoiceCurrTotal = recordObj.getValue({fieldId: "total"});
					var invoiceCurrTax = recordObj.getValue({fieldId : 'taxtotal'});

					var invoice_TranId= recordObj.getValue({fieldId: "tranid"});

					var otherrefnum = '';

					// added by lucas 7-21 as per Anna's request;
					if (channel == '7' || channel == '65'){
						var authNum = recordObj.getValue({fieldId:'custbody_mb_authorization_number'})
						var otherrefnum = authNum.substring(5,authNum.length);
						log.debug('otherrefnum for OD', otherrefnum);
				// } else if(invoice_entity == '58' || invoice_entity == 58 || invoice_entity == '59' || invoice_entity == 59 ||invoice_entity == '61' || invoice_entity == 61 || invoice_entity == '67'  || invoice_entity ==67 || invoice_entity == '63' || invoice_entity==63 || invoice_entity =='3915' || invoice_entity == '3914' || invoice_entity == '3913') { 
					
					} else if (channel == '16' || channel == '15' || channel == '8' || channel == '9' || channel == '11') {
					//stap adv ca, stap ca, wb, target,wmv, stap adv bnc,quill bnc 
					//16,15,8,9,11,
						var merchantOrderId = recordObj.getValue({fieldId : 'custbody_mb_merchant_order_id'});
						var otherrefnum = merchantOrderId
						log.debug('otherrefnum for WB/Targ/Staples',otherrefnum);
					} else if (channel == '3' || channel == '69' || channel == '10'){

						var otherrefnum = recordObj.getValue({fieldId : 'custbody_mb_customer_order_number'});

					} else if (channel == '1' || channel=='57' || channel=='58' || channel=='66'|| channel == 1 || channel==57 || channel==58 || channel==66){
						// var otherrefnum = //recordObj.getText({fieldId : 'createdfrom'});
						var tranDateObj = new Date(ffTranDate);
						var tranDateYr = (tranDateObj.getYear()-100).toString();
						var tranDateMonth = (tranDateObj.getMonth()+1).toString().length == 1 ? "0" + (tranDateObj.getMonth()+1).toString() : (tranDateObj.getMonth()+1).toString();
						var tranDateDate =  (tranDateObj.getDate()).toString().length == 1 ? "0" + (tranDateObj.getDate()).toString() : (tranDateObj.getDate()).toString();
						var dateCreatedStr = (new Date().getDate()).toString().length == 1 ? "0" + (new Date().getDate()).toString() : (new Date().getDate()).toString()


						var dateStr = "-"+tranDateYr+tranDateMonth+tranDateDate+dateCreatedStr;
						otherrefnum= soId+dateStr;
						
					} else {

						var otherrefnum = recordObj.getValue({fieldId: "otherrefnum"});

						log.debug("otherrefnum",otherrefnum);

					}

					if(channel == '8' && actualShipCost>0){
						recordObj.setValue({fieldId : 'shipmethod',value : '29585'}) // UPS Ground - default ship method for WB Mason;
						recordObj.setValue({fieldId : 'shippingcost',value : actualShipCost});
					} else {
						log.debug('not setting ship cost for non-WB record',actualShipCost);
					}

					log.debug("otherrefnum(PO#)",otherrefnum);
		
					var import_batch = recordObj.getValue({fieldId: "custbody_mb_import_batch"});
					
					log.debug(" otherrefnum, invoice_TranId, storeId, invoice_entity,import_batch ", otherrefnum+'##'+invoice_TranId+'##'+ invoice_entity+'##'+import_batch);
					// ignore DTC Channels; 
					if(storeId!=null){
						// if (channel == '1' || channel=='57' || channel=='58' || channel=='66'|| channel == 1 || channel==57 || channel==58 || channel==66){
							// var newTranId = '';
						// } else {
							var newTranId = CheckTranId(invoice_TranId,otherrefnum,storeId,invoice_entity);
						// }
						if (newTranId != "")
						{
							log.debug(" TranId will be updated ", newTranId);
							recordObj.setValue('tranid', newTranId);
						}
					}

					log.debug(" SourceTotal and SoureTax will be updated as import batch is  ", import_batch);
					// ignore DTC Channels; 
					if(channel!='3' && channel !='69' && channel!='58' && channel!= '57' && channel !='66'){
						recordObj.setValue('otherrefnum',otherrefnum);
					};

					log.debug('InvoiceCurrTotal##InvoiceCurrTax', invoiceCurrTotal+'###'+invoiceCurrTax);
					var subTotal = parseFloat(invoiceCurrTotal) - parseFloat(invoiceCurrTax);

					// RCM Taxjar removal
					// // updated 4/12 for TaxJar Tax Handling - only update taxes for DTC channels, ignore Staples CA Channels; 
					// log.debug('subTotal', subTotal);
					// if(channel!='16'&& channel!='15'){
					// 	if(subTotal!=soSubtotal){
					// 		var proportion = parseFloat(taxProportion);//subTotal/parseInt(soSubtotal);
					// 		var newTaxTotal = proportion * invoiceCurrTotal;
					// 		taxTotal = newTaxTotal;
					// 		log.debug('old taxTotal, newTaxTotal', taxTotal+', '+newTaxTotal);
					// 		recordObj.setValue('custbody_tj_external_tax_amount', newTaxTotal);
					// 	} else {
					// 		var newTaxTotal = taxTotal
					// 		recordObj.setValue('custbody_tj_external_tax_amount', newTaxTotal);

					// 	}
					// };

					recordObj.setValue('custbody_mb_source_invoice_total', invoiceCurrTotal+taxTotal);
					recordObj.setValue('custbody_mb_source_inv_tax_amount', taxTotal);	

					// Pramod Added May 2022  (END)
					var invoiceId = recordObj.save({
						enableSourcing : false,
						ignoreMandatoryFields : true
					});

					log.debug({
						title : 'Invoice ID',
						details : invoiceId
					});
					log.audit({
						title : 'Invoice ID for '+soId,
						details : invoiceId
					});

					var summaryString = _channel+','+result.soId.toString()+','+invoiceId.toString()+',false,'+resultLength.toString()+','+context.executionNo.toString()+','+context.isRestarted;
					context.write({
						key: _channel+'-'+context.key,
						value: summaryString
					});

				}catch(e){
					log.error('error in key: '+context.key+', soId failure on '+soId+', channel: '+_channel,e);
					var summaryString = _channel+','+result.soId.toString()+','+e.message+',true,'+resultLength.toString()+','+context.executionNo.toString()+','+context.isRestarted;
					context.write({
						key: _channel+'-'+context.key,
						value: summaryString
					});
					continue;
					// var summaryString = result.soId.toString()+','+'Error: '+e.message+','+resultLength.toString() 
					// context.write({
					// 	key: context.key,
					// 	value: summaryString
					// });
					// if (e.name =='SSS_TIME_LIMIT_EXCEEDED' || e.name == 'SSS_USAGE_LIMIT_EXCEEDED'){
					// 	throw e;
					// } else {
					// 	continue;
					// }
				}
			}
			
		// }catch(e){
		// 	log.error("error in reduce step for "+key,JSON.stringify(e));
		// 	if (e.name =='SSS_TIME_LIMIT_EXCEEDED' || e.name == 'SSS_USAGE_LIMIT_EXCEEDED'){
		// 		throw e;
		// 	}
		// 	// return true;
		// }

	}

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
			var contents = 'key,channel,soId,invoiceId,isError,resultsInReduce,executionNo,isRestarted'+'\n';
			context.output.iterator().each(function(key, value) {
				contents += (key + ',' + value + '\n');
				return true;
			});
			var d = new Date();
			var month = d.getMonth()+1;
			var day   = d.getDate();
			var hour = d.getHours();
			// Create the output file
			//
			// Update the name parameter to use the file name of the output file
			var fileObj = file.create({
				name: (d.getFullYear()).toString() + (month>9 ? month : '0'+month).toString() + (day >9 ? day : '0'+day).toString()+hour.toString()+'_Invoice_Processing_ResultsLog.CSV',
				fileType: file.Type.CSV,
				contents: contents
			});
	
			// Specify the folder location of the output file, and save the file
			//
			// Update the fileObj.folder property with the ID of the folder in
			// the file cabinet that contains the output file
			fileObj.folder = 741;
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

	function searchGetAllResult(option,max){
		var result = [];
		if(option.isLimitedResult == true){
			var rs = option.run();
			result = rs.getRange(0,400);

			return result;
		}

		var rp = option.runPaged();
		rp.pageRanges.forEach(function(pageRange){
			var myPage = rp.fetch({index: pageRange.index});
			result = result.concat(myPage.data);
		});

		return result;
	};

	function searchGetResultObjects(search,_start,_end,max){
		try{
			// added column for Type;
			var results;
			if (_start!=null && _end!=null){
				results = search.run()//.getRange({
				results = results.getRange({
					start : _start,
					end : _end
				})

				//});
		} else {
			results = searchGetAllResult(search,max);
		};
//				log.debug('results',JSON.stringify(results));

		var columns = search.columns;
		log.debug('columns',JSON.stringify(columns));

		var arrResults = new Array();

//				log.debug('results.length',results.length);

		for (var k=0;k<results.length;k++){

			var tempObj = new Object();				
			var result = results[k];
			tempObj.type = result.recordType;
			tempObj.id = result.id;
			for (i=0;i<columns.length;i++){

				if (columns[i].hasOwnProperty('join')==false){
					columns[i].join=null;
				};
				if (columns[i].hasOwnProperty('summary')==false){
					columns[i].summary = null;
				}

				var propName = columns[i].label.replace(/ /g,"_");

				if (propName=='itemSub'){
					var tempName = propName+'_text';

					tempObj[tempName] = result.getText({
						name : columns[i].name,
						join : columns[i].join,
						summary : columns[i].summary
					});
				};

				tempObj[propName] = result.getValue(columns[i]);
			};

//					tempArray.push(tempObj);
			arrResults.push(tempObj);
		};
		return arrResults;
		} catch(err){
			log.error('err in searchGetResultObjects',JSON.stringify(err));
			/*email.send({
				author: '1423',
				recipients : ['Lucas@mibar.net','netsuite@mibar.net','support@mibar.net'],
				subject : 'Error in searchGetResultObjects -  MB_Scheduled_Cleanup_Unprocessed_Invoices.js',
				body : 'Please see the attached error in the "dataIn" function: \n'+JSON.stringify(err),
			});*/

		}
	}

	function CheckTranId(invTranId,poNumber,storeID,entity)
	{
		if (invTranId.toLowerCase().indexOf('-he') < 0 && invTranId.toLowerCase().indexOf('-bnc')< 0 && invTranId.toLowerCase().indexOf('-he') < 0 && invTranId.toLowerCase().indexOf('Generated')< 0)
			return "";
   
		if (poNumber == "")
			return "";
		
		//storeID = getStoreID(entity);
		if(storeID!='INV'){
			storeID = storeID.replace(/\D/g,'');
			storeID = storeID+'_';

		} else {
			storeID = '';

		}
		 // remove all except numbers
		  log.debug(" storeID will be ", storeID);
		
		return 		storeID + poNumber;
	}

	function getDateValue(dateAsString) {
		try {
			var trandate = format.parse({
				value: dateAsString,
				type: format.Type.DATE
			});
		} catch (e) {
			log.error('IR RecordHandler', 'Parse date error: ' + e.message);
		}
		return trandate;
	};

	return {

		config:{
			retryCount: 3,
			exitOnError: false
		},


		getInputData: getInputData,
		map: map,
		reduce: reduce,
		summarize: summarize
	};

});