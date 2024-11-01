/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

var runForChannel = []
define(['N/record', 'N/runtime', 'N/search', 'N/error', 'N/ui/serverWidget'],
	/**
	 * @param{record} record
	 */
	(record, runtime, search, error, serverWidget) => {
		/**
		 * Defines the function definition that is executed before record is loaded.
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.newRecord - New record
		 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
		 * @param {Form} scriptContext.form - Current form
		 * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
		 * @since 2015.2
		 */
		const beforeLoad = (scriptContext) => {
			try {
				var channels = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_channels' });
				if (channels) {

					runForChannel = channels.split(',')
					log.debug("runForChannel", runForChannel);
					var channelVal = scriptContext.newRecord.getValue({ fieldId: "class" });
					log.debug("channelVal", channelVal)
				}



				var showFor = ["salesorder", "invoice"]
				log.debug("Record Type", scriptContext.newRecord.type);
				log.debug("Record Type Valid", showFor.indexOf(scriptContext.newRecord.type) == -1);
				if (showFor.indexOf(scriptContext.newRecord.type) == -1)
					return;

				var form = scriptContext.form;
				var field = form.addField({
					id: "custpage_linedisocunt",
					type: serverWidget.FieldType.INLINEHTML,
					label: "Line Discount"
				});
				{
					var recordObj = scriptContext.newRecord;
					var itemLineCount = recordObj.getLineCount({ sublistId: 'item' });
					log.debug("itemLineCount", itemLineCount);
					var totalLineDiscount = 0;
					for (var d = 0; d < itemLineCount; d++) {
						var itemType = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: d });
						var amount = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: d });
						log.debug("itemType", itemType)
						if (itemType == "Discount") {
							totalLineDiscount += amount
						}
					}
					log.debug("totalLineDiscount", totalLineDiscount)
				}
				var discountHtml = '<tr><td>' +
					'<div class="uir-field-wrapper" data-field-type="currency"><span id="customdiscount_fs_lbl_uir_label" class="smalltextnolink uir-label "><span id="customdiscount_fs_lbl" class="smalltextnolink" style="">' +
					'<a tabindex="-1" title="Discount" href="javascript:void(&quot;help&quot;)" style="cursor:help" onclick="" class="smalltextnolink" onmouseover="this.className="smalltextul"; return true;" onmouseout="this.className="smalltextnolink"; ">Line Discount</a>' +
					'</span></span><span class="uir-field inputreadonly">' +
					'<span id="discount_fs" class="inputtotalling"><span id="discount_val" class="inputtotalling" datatype="currency">0.00</span></span><input name="line_discount" id="line_discount" type="hidden" value="0.00" datatype="currency">' +
					'</span>' +
					'</div>' +
					'</td>' +
					'<td></td></tr>';



				field.defaultValue = "<script>jQuery(document).ready(function(){try{" +
					"var mode ='" + scriptContext.type + "';" +
					"console.log('mode '+mode);" +
					"var rowCount = jQuery('.totallingtable tr').length;" +
					"console.log(\"Row Count \"+rowCount);" +
					"jQuery('.totallingtable  > tbody > tr').eq(rowCount-3).after('" + discountHtml + "');" +
					"console.log('Cond',(mode == 'view'));" +
					'var lineDiscount ="' + totalLineDiscount + '";' +//jQuery("#custbody_mb_inv_header_discount").val();'+
					'lineDiscount = (lineDiscount == "" || lineDiscount == "NaN"|| lineDiscount == undefined ) ? 0 : lineDiscount; ' +
					'jQuery("#discount_val").text(parseFloat(lineDiscount).toFixed(2));' +
					"console.log('lineDiscount',lineDiscount);" +
					'if(mode == "view"){' +
					'var discountValue = "' + totalLineDiscount + '";' +
					'discountValue = (discountValue == "" || discountValue == "NaN"|| discountValue == undefined ) ? 0 : discountValue; ' +
					'jQuery("#discount_val").text(parseFloat(discountValue).toFixed(2));' +
					"jQuery('#discount_val').css('font-weight', 'bold');}" +
					'jQuery("#custbody_mb_inv_header_discount_formattedValue").change(function(){' +
					'var lineDiscount = jQuery("#custbody_mb_inv_header_discount").val();' +
					'lineDiscount = (lineDiscount == "" || lineDiscount == "NaN"|| lineDiscount == undefined ) ? 0 : lineDiscount; ' +
					'jQuery("#discount_val").text(parseFloat(lineDiscount).toFixed(2));' +
					'});' +
					"}catch(e){alert(e);console.log(e)}})</script>";

				const bncChannels = ["69", "65", "64", "62", "63", "70", "67", "71", "61", "82", "60", "66", "57", "58"];
				log.debug("bncChannels", bncChannels.indexOf(1));

				{ // As a part of the Override Decision tree logic.
					try{
   
					   var overrideValue = scriptContext.newRecord.getValue({fieldId:"custbody_mb_decision_override"});
					   log.debug("overrideValue",overrideValue);
   
				   
   
					   var printVendorMapping = {
						   31885 : "Taylor",
						   31394 : "Dupli"
					   }
   
					   var objRecord = record.create({
						   type: record.Type.SALES_ORDER,
						   isDynamic : true
						});
   
					   var field = scriptContext.form.addField({
						   id: "custpage_overridedecision",
						   type: serverWidget.FieldType.SELECT,
						   label: "Order Decision Override"
					   });
					   
					   scriptContext.form.insertField({
						   field : "custpage_overridedecision",
						  nextfield : 'custbody_mb_trx_order_dec_breakdown'
                        //  nextfield: 'tranid'
					   });
                      
					   var objField = objRecord.getField({
						   fieldId: 'custbody_mb_decision_override'
						}); 
   
						var options = objField.getSelectOptions({
						   filter : '',
						   operator : ''
					   });
						log.debug("options",options)
   
						var baseItem = scriptContext.newRecord.getSublistValue({sublistId:"item",fieldId:"item",line:0});
   
					   if(baseItem!='' && baseItem!=null){
						var customrecord_mb_adder_vendor_costsSearchObj = search.create({
						   type: "customrecord_mb_adder_vendor_costs",
						   filters:
						   [
							  ["custrecord_mb_adder_item.internalid","anyof",baseItem]
						   ],
						   columns:
						   [
							  search.createColumn({
								 name: "custrecord_mb_vendor",
								 summary: "GROUP",
								 label: "Vendor"
							  }),
							  search.createColumn({
								 name: "custrecord_mb_stock_supplied_vc",
								 summary: "GROUP",
								 label: "Stock Supplied Vendor Cost"
							  })
						   ]
						});
						var searchResultCount = customrecord_mb_adder_vendor_costsSearchObj.runPaged().count;
						log.debug("customrecord_mb_adder_vendor_costsSearchObj result count",searchResultCount);
						
						var vendoAndStock = {};
   
						customrecord_mb_adder_vendor_costsSearchObj.run().each(function(result){
   
						   var vendor  		= result.getValue({ name: "custrecord_mb_vendor",summary: "GROUP",label: "Vendor"});
						   var stockSupplied   = result.getValue({name: "custrecord_mb_stock_supplied_vc",summary: "GROUP",label: "Stock Supplied Vendor Cost"});
						   log.debug("stockSupplied",stockSupplied)
   
						   vendoAndStock[printVendorMapping[vendor]] = stockSupplied == true ? "YES" : "NO"
   
						   return true;
						});
   
						var filteredOptions  = options.filter((obj) =>{
   
						   var option 	 = (obj.text).split("-");
						   var vendor 	 = option[0].trim(); 
						   var process  = option[1].trim(); 
   
						   log.debug("vendor",vendor);
						   log.debug("process",process);
						   log.debug("Object.keys(vendoAndStock)",Object.keys(vendoAndStock));
						   log.debug("Object.keys(vendoAndStock).indexOf(vendor)",Object.keys(vendoAndStock).indexOf(vendor));
						   log.debug("Object.keys(vendoAndStock).indexOf(vendor)",vendoAndStock[Object.keys(vendoAndStock).indexOf(vendor)]);
						   log.debug("process.indexOf('Droship')",process == "Droship");
   
						   if(Object.keys(vendoAndStock).indexOf(vendor.trim()) != -1 &&  ( process == "Dropship" || (vendoAndStock[vendor] == 'YES' && process == "StockSupplied"))){
							   return obj;
						   }
   
						});
   
						log.debug("filteredOptions",filteredOptions)
   
						field.addSelectOption({
						   value : '',
						   text : ''
						});
   
						for(var i=0;i<filteredOptions.length;i++){
   
						   
						   field.addSelectOption({
							   value : filteredOptions[i]["value"],
							   text : filteredOptions[i]["text"]
						   });
   
						}
   
						if(overrideValue){
						   field.defaultValue = overrideValue;
						}
					   }
					  }catch(e){ log.error("Exception In Decision Override",e); }
				   }


			} catch (e) {
				log.error("Exception In Customizing Summary Box", e);
			}

		}

		/**
		 * Defines the function definition that is executed before record is submitted.
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.newRecord - New record
		 * @param {Record} scriptContext.oldRecord - Old record
		 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
		 * @since 2015.2
		 */
		const beforeSubmit = (sc) => {
			try {
				var channels = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_channels' });
				if (channels) {
					runForChannel = channels.split(',')
					log.debug("runForChannel", runForChannel);
				}
				if (runtime.executionContext === runtime.ContextType.USEREVENT) {
					var objRecord = record.load({ type: record.Type.SALES_ORDER, id: sc.newRecord.id, isDynamic: true });
					var channelVal = objRecord.getValue({ fieldId: "class" });

				} else {
					var channelVal = sc.newRecord.getValue({ fieldId: "class" });
				}
				log.debug("channelVal", channelVal)


				{ /** This block is used to Un check the proccessed check box on Sales orders,Item Fulfilements, Invoices when the record is modified. **/
					const allowedRecordTypes = ["salesorder", "itemfulfillment"];

					if (channelVal == 1) {
						if (allowedRecordTypes.indexOf(sc.newRecord.type) != -1 && runtime.executionContext !== runtime.ContextType.MAP_REDUCE && sc.type === sc.UserEventType.EDIT) {
							updateProccesedField(sc);
						}
					}
				}
				{ /** This Block is use to update channels in the line level with parent level channel */
					const bncChannels = ["69", "65", "64", "62", "63", "70", "67", "71", "61", "82", "60", "66", "57", "58"];

					if (sc.newRecord.type == "salesorder" && runtime.executionContext === runtime.ContextType.USER_INTERFACE && bncChannels.indexOf(channelVal) != -1) {
						updateChannel(sc);
					}
				}


				{ // As a part of the Override Decision tree logic.

					try{

						var overrideDecision = sc.newRecord.getValue({fieldId:"custpage_overridedecision"});
						log.debug("overrideDecision",overrideDecision);

						sc.newRecord.setValue({fieldId:"custbody_mb_decision_override",value:overrideDecision});

					}catch(e){ log.error("Exception In Decision Override",e); }
				}
				

			} catch (e) {
				log.error('Exception in Before Submit', e);
			}

		}

		/**
		 * Defines the function definition that is executed after record is submitted.
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.newRecord - New record
		 * @param {Record} scriptContext.oldRecord - Old record
		 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
		 * @since 2015.2
		 */
		const afterSubmit = (sc) => {
			try {
				var channels = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_channels' });
				if (channels) {
					runForChannel = channels.split(',')
					log.audit("runForChannel", runForChannel);
				}
				var objRecord = sc.newRecord
				log.audit('executionContext', runtime.executionContext);
				if (runtime.executionContext === runtime.ContextType.USEREVENT || runtime.executionContext === runtime.ContextType.CSV_IMPORT) {
					var objRecord = record.load({ type: sc.newRecord.type, id: sc.newRecord.id, isDynamic: true });

				}/*else{
					var channelVal = sc.newRecord.getValue({fieldId:"class"});
		 		}*/
				var channelVal = objRecord.getValue({ fieldId: "class" });

				if (channelVal == '' && objRecord.type == record.Type.CUSTOMER_DEPOSIT) {
					objRecord.getValue({ fieldId: 'salesorder' });
					var soChannelLookup = search.lookupFields({
						type: search.Type.SALES_ORDER,
						id: objRecord.getValue({ fieldId: 'salesorder' }),
						columns: ['class']
					});
					log.audit('soChannelLookup', soChannelLookup.class[0].value);
					if (soChannelLookup.class[0].value != '') {
						channelVal = soChannelLookup.class[0].value;
					}
				}
				log.audit("channelVal", channelVal)
				if (runForChannel.indexOf(channelVal) == -1)
					return;

				{

					/**
					  *	This block is used to make the Check Order Deposit check box to true on Sales orders if the total number of deposit amounts do not match sales order amount.
					  */
					log.audit('context', runtime.executionContext);
					var allowedRecordTypes = ["salesorder", "customerdeposit","customerrefund"];
					log.audit('type', objRecord.type);
					if (allowedRecordTypes.indexOf(objRecord.type) != -1 && (runtime.executionContext === runtime.ContextType.USER_INTERFACE || runtime.executionContext === runtime.ContextType.RESTLET || runtime.executionContext === runtime.ContextType.USEREVENT || runtime.executionContext === runtime.ContextType.CSV_IMPORT)) {
						updateCheckOrderDeposits(sc, objRecord);
					}
				}
			} catch (e) {
				log.error('Exception in After Submit', e);
			}



		}


		const updateCheckOrderDeposits = (scriptContext, _record) => {
			try {


				var terms = runtime.getCurrentScript().getParameter({ name:'custscript_terms_to_exclude'});
				log.debug("terms",terms);

				var termToExculde = [];
				if(terms && terms.indexOf(',') != -1){
					termToExculde = terms.split(',');
				}else if(terms){
					termToExculde.push(terms);
				}
				log.debug("termToExculde",termToExculde);

				

				{// Added on 5/24/2023 Applying credit memo to a customer deposit scenario
					log.debug("scriptContext.type and id",_record.type +" and "+scriptContext.newRecord.id)
					log.debug("scriptContext.type == customerrefund",_record.type == "customerrefund")
					if(_record.type == "customerrefund"){
						var recordObject 	  = scriptContext.newRecord;
						log.debug("Record Id",recordObject.id)
							recordObject      = record.load({type:recordObject.type,id:recordObject.id});
						var depositLine    	  = recordObject.findSublistLineWithValue({sublistId:"apply",fieldId:"trantype",value: "DepAppl" });
						var depositAppId      = recordObject.getSublistValue({sublistId:"apply",fieldId:"doc",line:depositLine});
						var amount         	  = recordObject.getSublistValue({sublistId:"apply",fieldId:"total",line:depositLine});
						log.debug("Details", `depositLine = ${depositLine}   depositId = ${depositAppId}  amount = ${amount}`)

						if(!depositAppId){
							return;
						}
						var depAppObj   = record.load({type:"depositapplication",id:depositAppId,isDynamic:true});
						var customerDepositId = depAppObj.getValue({fieldId:"deposit"});
						log.debug("customerDepositId",customerDepositId)
						if(customerDepositId){
							var lookUpFields = search.lookupFields({
								type	: "customerdeposit",
								id		: customerDepositId,
								columns	: ["salesorder","totalamount"]
							});
							log.debug("lookUpFields",lookUpFields);
							if(lookUpFields.hasOwnProperty('salesorder') && lookUpFields["salesorder"].length>0)
							var soId      = lookUpFields["salesorder"][0]["value"];

							if(lookUpFields.hasOwnProperty('salesorder'))
							var cdAmount  = lookUpFields["totalamount"];
							if(!soId){
								return;
							}
							var soRecObj  = record.load({type:"salesorder",id:soId});
							var terms     = soRecObj.getValue({fieldId:"terms"});
							log.debug("terms",terms)
							var statusSO  =  soRecObj.getValue({fieldId:"terms"});
							log.debug("statusSO",statusSO)

							if(termToExculde.indexOf(terms) != -1){
								log.emergency("ABORTED ON Customer Refund","Terminated Based on Terms")
								return;
							}

							var soTotal   = soRecObj.getValue({fieldId:"total"});
							log.debug("soTotal",soTotal);
							log.debug("(Number(cdAmount) - Number(amount)",(Number(cdAmount) - Number(amount)).toFixed(2));
							var difference = (Number(cdAmount) - Number(amount)).toFixed(2)
							if(Number(soTotal) == (Number(cdAmount) - Number(amount)).toFixed(2) || Math.abs(difference) == Math.abs(0.01)){
								soRecObj.setValue({fieldId:"orderstatus",value:"B"});
								soRecObj.setValue({fieldId:"custbody_mb_check_order_deposits",value:false});
								if(statusSO != "B"){
									soRecObj.setValue({fieldId:"custbody_tss_shipping_confirmation_box",value:false});
								}
								var salesOrderId = soRecObj.save();
								log.debug("salesOrderId",salesOrderId)
							}
							
						}
						
						return;
					}
				}



				var amountObject = {
					"salesorder"      : "total",
					"customerdeposit" : "payment"
				};
				var salesOrderStatus = null;
				if (scriptContext.newRecord.type == 'customerdeposit') {
					var newRecordObj  = scriptContext.newRecord;
					var createdFrom   = newRecordObj.getValue({fieldId:"salesorder"});;
					if(createdFrom){
						var terms = getSalesOrderTerms(createdFrom)
						log.debug("terms",terms)
					}
				} else {
					var newRecordObj  = _record;//scriptContext.newRecord;
					var terms         = newRecordObj.getValue({fieldId:"terms"});
					salesOrderStatus  = newRecordObj.getValue({fieldId:"orderstatus"});
				}

				log.debug("salesOrderStatus",salesOrderStatus);
				
				if(termToExculde.indexOf(terms) != -1){
					log.emergency("ABORTED","Terminated Based on SO Terms")
					return;
				}

				var oldRecordObj = scriptContext.oldRecord || null;

				var subsidiary = newRecordObj.getValue({ fieldId: 'subsidiary' });
				log.emergency("subsidiary", subsidiary);
				log.emergency('context type2', runtime.executionContext);
				log.emergency('scriptContext.newRecord.id', scriptContext.newRecord.id);
				if (subsidiary != 18)
					return;

				var orderDepositOverride = scriptContext.newRecord.getValue({ fieldId: "custbody_mb_order_deposits_override" });
				log.emergency("orderDepositOverride", orderDepositOverride)
				if (orderDepositOverride) {
					var valuesObject = { "custbody_mb_check_order_deposits": false , "orderstatus": "B" }
					if(salesOrderStatus != "B"){
						valuesObject["custbody_tss_shipping_confirmation_box"] = false;
					}


					var id = record.submitFields({
						type   : record.Type.SALES_ORDER,
						id     : scriptContext.newRecord.id,
						values :valuesObject,
						options: {
							enableSourcing: false,
							ignoreMandatoryFields: true
						}
					});
					return;
				}

				var recordId   = newRecordObj.id;
				var recordType = newRecordObj.type;
				var operation  = scriptContext.type;
				log.emergency("Record Details", `Record Type ${recordType}<br/>Record Id ${recordId} <br/> Operation ${operation}`);


				var oldPaymentAmount  =  (oldRecordObj != null) ? oldRecordObj.getValue({ fieldId: amountObject[recordType] }) : null;
				var newPaymentAmount  =  newRecordObj.getValue({ fieldId: amountObject[recordType] });
				var salesOrderId 	  =  recordType == "customerdeposit" ? newRecordObj.getValue({ fieldId: 'salesorder' }) : newRecordObj.id

				log.emergency("Details", `Sales Order id = ${salesOrderId} <br> Old Amount  = ${oldPaymentAmount} <br> New Amount =  ${newPaymentAmount}`)

				if ((recordType == "salesorder" && oldPaymentAmount == newPaymentAmount) || (recordType == "customerdeposit" && (!salesOrderId || oldPaymentAmount == newPaymentAmount)) && scriptContext.type !== scriptContext.UserEventType.DELETE) {
					var msg = recordType == "salesorder" ? "There is no change in the orders total." : "Eiher due to no change in amount or due to deposit not attched to an Sales Order";
					log.emergency("<b style='color:red;'>Process Terminated</b>", msg)
					//return;
				}



				var fieldLookUp = search.lookupFields({
					type    : search.Type.SALES_ORDER,
					id      : salesOrderId,
					columns : ['status', 'amount']
				});
				log.audit('fieldLookUp', JSON.stringify(fieldLookUp))
				var status = fieldLookUp["status"][0]["text"];                      // Staus A = Pending Approval  B = Pending Fulfilment
				var amount = fieldLookUp["amount"];
				log.audit('SO AMOUNT', amount);

				if (amount == 0) {
					var valuesObject = new Object();
					valuesObject['custbody_mb_check_order_deposits'] = false;
					valuesObject['orderstatus'] 					 = 'B'
					if(status == "Pending Approval"){
						valuesObject["custbody_tss_shipping_confirmation_box"] = false;
					}

					var id = record.submitFields({
						type: record.Type.SALES_ORDER,
						id: salesOrderId,
						values: valuesObject,
						options: {
							enableSourcing: false,
							ignoreMandatoryFields: true
						}
					});

					return true;
				}

				log.emergency("status", status);


				var cusDpstSearchObj = search.create({
					type   : "customerdeposit",
					filters:
						[
							["type", "anyof", "CustDep"],
							"AND",
							["salesorder.internalid", "anyof", salesOrderId],
							"AND",
							["mainline", "is", "T"]
						],
					columns:
						[
							search.createColumn({
								name: "amount",
								summary: "SUM",
								label: "Amount"
							}),
							search.createColumn({
								name: "total",
								join: "salesOrder",
								summary: "AVG",
								label: "Amount (Transaction Total)"
							})
						]
				});

				cusDpstSearchObj.run().each(function (result) {
					log.emergency("Result", result)
					var totalDepositsAmount = result.getValue((cusDpstSearchObj.columns)[0]);
					var salesOrderAmount    = result.getValue((cusDpstSearchObj.columns)[1]);
					var differenceAmount    = (Number(totalDepositsAmount) - Number(salesOrderAmount)).toFixed(2)
					log.debug("differenceAmount",differenceAmount);
					log.emergency("Search details", `totalDepositsAmount ${totalDepositsAmount} <br> salesOrderAmount ${salesOrderAmount}`)
					var valuesObject = {}

					if (!(salesOrderAmount > 0)) {
						valuesObject['custbody_mb_check_order_deposits'] = true;
						valuesObject['orderstatus'] = 'A'
						if(salesOrderStatus != "A"){
							valuesObject["custbody_tss_shipping_confirmation_box"] = false;
						}

					} else {
						log.debug("Number(totalDepositsAmount) != Number(salesOrderAmount)",Number(totalDepositsAmount) != Number(salesOrderAmount))
						log.debug("differenceAmount != Math.abs(0.01)",differenceAmount != Math.abs(0.01))
						log.debug("(Number(totalDepositsAmount) != Number(salesOrderAmount) && differenceAmount != Math.abs(0.01))",(Number(totalDepositsAmount) != Number(salesOrderAmount) && differenceAmount != Math.abs(0.01)))

                        log.debug("Adjusted check - soAmount, depAmount, adjusted depAmount", Number(salesOrderAmount).toString() + ', ' + Number(totalDepositsAmount).toString() + ', ' + (Number(totalDepositsAmount) + .01).toString())
    					
						valuesObject['custbody_mb_check_order_deposits'] = (Number(salesOrderAmount) > (Number(totalDepositsAmount) + .01)) /*  && Math.abs(differenceAmount) > Math.abs(0.01))*/ ? true : false
    					valuesObject['orderstatus'] = (Number(salesOrderAmount) > (Number(totalDepositsAmount) + .01)) ? 'A' : 'B'

						/*valuesObject['custbody_mb_check_order_deposits'] = (Number(totalDepositsAmount) != Number(salesOrderAmount) && Math.abs(differenceAmount) != Math.abs(0.01)) ? true : false
						valuesObject['orderstatus'] = Number(totalDepositsAmount) >= Number(salesOrderAmount) ? 'B' : 'A'
						if (valuesObject['custbody_mb_check_order_deposits'] && Number(totalDepositsAmount) < Number(salesOrderAmount) &&  Math.abs(differenceAmount) != Math.abs(0.01) && status == "Pending Fulfillment")
							valuesObject['orderstatus'] = 'A' */

							if(salesOrderStatus != valuesObject['orderstatus']){
								valuesObject["custbody_tss_shipping_confirmation_box"] = false;
							}
					}
					try {
						log.emergency("valuesObject", valuesObject)
						var id = record.submitFields({
							type: record.Type.SALES_ORDER,
							id: salesOrderId,
							values: valuesObject,
							options: {
								enableSourcing: false,
								ignoreMandatoryFields: true
							}
						});
					} catch (err) {
						if (err.name == 'INVALID_ORD_STATUS') {
							log.error("Order already processed error - marking order to  have check deposits set to true to prevent processing");
							var id = record.submitFields({
								type: record.Type.SALES_ORDER,
								id: salesOrderId,
								values: { custbody_mb_check_order_deposits: valuesObject['custbody_mb_check_order_deposits'] },
								options: {
									enableSourcing: false,
									ignoreMandatoryFields: true
								}
							});
						} else {
							throw err;
						}
					}

					log.emergency("Sales Order ID", id);
					return true;
				});

			} catch (e) {
				log.error("Exception in Update Order Deposit Checkbox", e);

			}

		}

		const updateChannel = (scriptContext) => {
			try {
				var recObj = scriptContext.newRecord;
				log.debug("recObj", recObj);
				var channel = recObj.getValue({ fieldId: 'class' });
				log.debug("channel", channel);

				if (!channel)
					return;
				var lineCount = recObj.getLineCount({
					sublistId: 'item'
				});
				log.debug("updateChannel Line Count", lineCount);
				for (var i = 0; i < lineCount; i++) {
					var lineClass = recObj.getSublistValue({ sublistId: 'item', fieldId: 'class', line: i });
					log.debug("updateChannel lineClass", lineClass);
					if (!lineClass) {
						recObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: i, value: channel });
					}
				}


			} catch (e) {
				log.error("Exception in UPDATE CHANNEL", e);
			}
		}

		const updateProccesedField = (scriptContext) => {
			try {

				var recObj 			= scriptContext.newRecord;
				var oldRecObj 		= scriptContext.oldRecord;
				var channel 		= recObj.getValue({ fieldId: 'class' });
				var proccessed 		= recObj.getValue({ fieldId: 'custbody_mb_file_processed' });
				var oldProccessed 	= oldRecObj.getValue({ fieldId: 'custbody_mb_file_processed' });

				if (channel == 1) {

					if (oldProccessed != proccessed && proccessed == true) {
						recObj.setValue({
							fieldId: 'custbody_mb_file_processed',
							value: true
						});
					} else {
						recObj.setValue({
							fieldId: 'custbody_mb_file_processed',
							value: false
						});
					}
				}


			} catch (e) {
				log.error("Exception in Updating Processed Checkbox", e);
			}
		}

		const getSalesOrderTerms = (soId) =>{
			try{
				var soLookup = search.lookupFields({
                    type: 'salesorder',
                    id: soId,
                    columns: ['terms']
                });
                log.debug("Sales Order Lookup",soLookup);
				var terms = null;
				if(soLookup["terms"].length>0){
                 terms = soLookup["terms"][0]["value"];
                log.debug("terms",terms);
				}
                
				return terms;
			}catch(e){
				log.error("Exception in GET CSUTOMER TERMS",e)
			}
		}


		return { beforeLoad, beforeSubmit, afterSubmit }

	});