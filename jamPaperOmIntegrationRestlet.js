/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/**
 * Script Name               : TSS RL OM Outbound Integration
 * Script Author             : Bhargavi
 * Script Type               : Restlet 
 * Script Version            : 2.0
 * Script Created date       : 
 * 
 * Script Last Modified Date : 9-22-2022
 * Script Last Modified By   : MIBAR
 * Script Comments           : ----
 * 
 * Script Description        : 
 * This will be trigerred by Magento Application with required details in the request body.
 * This script parse the data received and creates a sales order, customer deposit (for payment details) and customer (based on address) as per the documentation.
 * Upon successful creation and in case of any issues, it will return back responses in a specific format.
 */

var recordId = '';
var depFlag = 'F';
var payEmptyFlag = false;
var paymentMethod = '';
var websiteobject = {'jam':'JAM','env':'ENV','fold':'F','cimpress':'CIM','lab':'LNS'};
var classObject = {'jam':1,'env':57,'fold':58,'cimpress':66,'lab':88};		
var custbody_mb_cc_last4Value = '';
var custbody_mb_cc_typeValue = '';
var custbody_braintree_idValue = '';
var custbody_braintree_chargedValue = '';
var custbody_payment_method_tokenValue = '';
// RCM add avalara taxing 
const SB_TAX_ITEM = 526774;                                            // 334396;
const TAX_ITEM = 539797
const SB_TAX_ITEM_CA = 526777                                          //334606;
const TAX_ITEM_CA = 539801
const DEF_NJLOCATION = 11;
const DEF_SYRLOCATION = 94;
const SB_SHIPPING_DISC = 529085;
const SHIPPING_DISC = 540705;
//const DEF_FOLDERS_FORM = '';
//const DEF_JAMFORM = '';
const JAM_SUB = 18;
const DEF_FORM = {'jam':329,"fold":329,"env":329,'cimpress':329,'lab':329};
// const DEF_FORM = {'jam':327,"fold":327};

const AMAZON_PAY = ['10','21','22'];
const PAYPAL = ['17']
const printUpchargeItem = '497200';
const US_EXEMPTION_CODE = '12';
const CA_EXEMPTION_CODE = '3';
var canadianProvinceMap = {
    "US" : {name : "US", nexus:1},
   "British Columbia" : {name: 'BC',nexus:8},
   "Yukon" : {name:'YT',nexus:21},
   "Saskatchewan" : {name:"SK",nexus:20},
   "Quebec": {name: 'QC',nexus:19},
   "Prince Edward Island": {name:"PE",nexus:18},
   "Ontario":{name:"ON",nexus:2},
   "Nunavut":{name:"NU",nexus:16},
   "Northwest Territories":{name:"NT",nexus:15},
   "Nova Scotia":{name:"NS",nexus:14},
   "Newfoundland" : {name:"NL",nexus:13},
   "Newfoundland and Labrador" : {name:"NL",nexus:13},
   "New Brunswick":{name:"NB",nexus:11},
   "Manitoba":{name:"MB",nexus:10},
   "Alberta":{name:"AB",nexus:9}
};


define(['N/search','N/record','N/format','N/runtime'],function(search,record,format,runtime) {
    const nsAccountId = runtime.accountId; 
    function doPost(requestParams) {
        
        try{
            log.audit('account',nsAccountId);
            var testOrder = false;
            var receivedJson = requestParams;
            log.audit('received Data: ',JSON.stringify(receivedJson));
            if(receivedJson != null && receivedJson != '' && receivedJson != '{}'){
                //LOGIC TO RETRIVE DATA STARTS
                var otherrefnum                       = receivedJson.otherrefnum || '';
                var trandate                          = receivedJson.trandate || '';
                var internalid                        = receivedJson.internalid || '';
                var classData                         = receivedJson.class || '';
                var isGuest                           = receivedJson.isGuest || '';
                paymentMethod                         = receivedJson.paymentmethod || '';
                var customerEmail                     = receivedJson.custbody_mb_order_email || '';
                
                // added by MIBAR 8-26-2022
                var magInternalId = null;
                if(receivedJson.hasOwnProperty('custbody_mb_mag_order_internalid')){
                   receivedJson.custbody_mb_mag_order_internalid || ''; 
                }
                  //added by MIBAR 8-30-2022, updated to send zero if null;
                var externalTaxAmount = receivedJson.custbody_tj_external_tax_amount || 0;
                log.audit('externalTaxAmount',externalTaxAmount);
                if(classData){
                    classData = classData.toLowerCase();
                };
                var classValue = classObject[classData];
                var addresses                         = receivedJson.addresses || '';
                var items                             = receivedJson.items || '';
                var payment_details                   = receivedJson.payment_details || '';
                // updated by MIBAR to exclude check payments if payment_details are empty and not null. 8-30-2022
                if(payment_details != '' && payment_details!=null && payment_details != undefined && Object.keys(payment_details).length != 0 && paymentMethod!='2' && paymentMethod!='1' && paymentMethod!=''){
                    depFlag = 'T';
                    var emptyIds  = [];
                    for(var key in payment_details){
                        var value = payment_details[key];
                        if(!value){
                            emptyIds.push(key);
                            payEmptyFlag = true;
                        }
                    }
                }
                custbody_mb_cc_last4Value = payment_details['custbody_mb_cc_last4'] || '';
                custbody_mb_cc_typeValue = payment_details['custbody_mb_cc_type']|| '';
                custbody_braintree_idValue = payment_details['custbody_braintree_id']|| '';
                custbody_braintree_chargedValue = recorrdBooleanCheck(payment_details['custbody_braintree_charged']);
                custbody_payment_method_tokenValue = payment_details['custbody_payment_method_token']|| ''; 
                // added by MIBAR - 9-26-2023;
                var terms = payment_details['terms'] || '';
                var tranid = '';
                if(websiteobject[classData] && otherrefnum){
                    tranid = websiteobject[classData]+otherrefnum;
                }
                if(!otherrefnum){
                  // changed to throw - MIBAR 8-26-2022
                    throw {
                        'Status': '0',
                        'Internal_ID': '',
                        'custombody_mb_transaction_id': tranid,
                        'otherrefnum': otherrefnum,
                        'custbody_mb_cc_last4': custbody_mb_cc_last4Value,
                        'custbody_mb_cc_type': custbody_mb_cc_typeValue,
                        '_error' :  {
                            'code': 'Error',
                            'message': 'Missing Required Field otherrefnum',
                            'error_severity' : 'High'
                        }
                    };
                }
                var searchFilters = new Array();
                searchFilters[searchFilters.length] = search.createFilter({name: 'type', join: null,operator: search.Operator.ANYOF, values: 'SalesOrd' });
                searchFilters[searchFilters.length] = search.createFilter({name: 'otherrefnum', join: null,operator: search.Operator.EQUALTO, values: otherrefnum });
                searchFilters[searchFilters.length] = search.createFilter({name: 'mainline', join: null,operator: search.Operator.IS, values: 'T' });
                
                searchFilters[searchFilters.length] = search.createFilter({name : 'class', join : null, operator : search.Operator.ANYOF, values: classValue});

                var searchColumns = new Array();
                searchColumns[searchColumns.length] = search.createColumn({name: 'internalid'});
                var salesOorderSearch = search.create({ type: 'salesorder', filters: searchFilters, columns: searchColumns}).run().getRange({start: 0, end: 10});
                log.debug('salesOorderSearch.length',salesOorderSearch.length);
                if(salesOorderSearch.length>0){
                    var salesOrderId = salesOorderSearch[0].getValue({name: 'internalid'});
                    //log.debug('salesOrderId',salesOrderId);
                  //changed to throw - MIBAR 8-26-2022
                    throw {
                        'Status': '0',
                        'Internal_ID':salesOrderId,
                        'custombody_mb_transaction_id':tranid,
                        'otherrefnum':otherrefnum,
                        'custbody_mb_cc_last4':custbody_mb_cc_last4Value,
                        'custbody_mb_cc_type':custbody_mb_cc_typeValue,
                        '_error' : {
                            'code': 'Error',
                            'message': 'The id (Magento Order Id) already exists in NetSuite',
                            'error_severity' : 'Medium'
                        }
                    };

                }else{
                    var manFieldsArray = ['trandate','internalid','class','items','isGuest'];
                    var emptyValueFields = new Array();
                    for(var a = 0;a<manFieldsArray.length;a++){
                        if(manFieldsArray[a]== 'items'){
                            if(receivedJson[manFieldsArray[a]].length>0){
                                // TODO

                            }else{	
                              //changed to throw MIBAR 8-26-2022
                                throw {
                                    'Status': '0',
                                    'Internal_ID': '',
                                    'custombody_mb_transaction_id': tranid,
                                    'otherrefnum': otherrefnum,
                                    'custbody_mb_cc_last4': custbody_mb_cc_last4Value,
                                    'custbody_mb_cc_type': custbody_mb_cc_typeValue,
                                    '_error' : {
                                        'code': 'Error',
                                        'message': 'Missing Item Details',
                                        'error_severity' : 'High'
                                    }
                                };
                            }
                        }
                        else {
                            if(!receivedJson[manFieldsArray[a]]){
                                emptyValueFields.push(manFieldsArray[a]);
                            }
                        }
                    }
                    log.debug('emptyValueFields',emptyValueFields);
                    if(emptyValueFields.length>0){
                      //changed to throw
                      var emptyFieldsErr = emptyFieldsReturnResponse(emptyValueFields);
                        throw emptyFieldsErr;
                    }

                    var dateString = trandate;
                    dateString 	   = dateString.split(' ');
                    dateString     = dateString[0].split('-');
                    var year       = dateString[0];
                    var month      = dateString[1];
                    var day        = dateString[2];
                    var finalFormat = month+'/'+day+'/'+year;
                    //log.debug('finalFormat',finalFormat);
                    //log.debug('classData',classData);
                   
                    // if(classData !='jam'){
                        // testOrder = true;
                    // }
                    var locationId = classValue == 1 ? DEF_NJLOCATION : DEF_SYRLOCATION;//'94';
                    //log.debug('classValue',classValue);
                    var itemDetails = receivedJson.items;
                    var addresses = receivedJson.addresses;

                    var salesOrderForm = DEF_FORM[classData];
                    
                   var customerNsId = internalid

                   if(isGuest == 'T'){
                       customerNsId = customerCreation(payment_details,recordId,internalid,isGuest,addresses,customerEmail,paymentMethod);
                       log.debug('customerNsId',customerNsId);
                       // Added by MIBAR 8-26-22
                       /*var soId = record.submitFields({
                           type : record.Type.SALES_ORDER,
                           id : recordId,
                           values : {'entity':customerNsId,'shipmethod':receivedJson.shipmethod}
                       });
                       log.debug('submitted new customer',soId);*/
                   }

                   // LPB 2024-04-05: Patch to handle nontaxable customers that entered a taxid in magento. 
                   var nonProfitTaxId = receivedJson.custbody_mb_nonprofit_taxid; 
                   if(nonProfitTaxId!='' && nonProfitTaxId!=null ) {    
                       var custNonTaxUpdate = record.submitFields({
                           type : record.Type.CUSTOMER,
                           id : customerNsId,
                           values : {
                               'custentity_ava_exemptcertno' : nonProfitTaxId
                           }
                       });
                       log.audit('updatedCustomerTaxability',custNonTaxUpdate);
                   };

                    //sales order creation starts from here
                    var objRecord = record.create({type: record.Type.SALES_ORDER,isDynamic:true,defaultValues:{customform: salesOrderForm}});
                    objRecord.setValue({fieldId : 'entity',value : customerNsId,ignoreFieldChange : false});
                    objRecord.setValue({fieldId:'subsidiary',value : JAM_SUB });

                    var taxItem = '';
                    if(addresses != '' && addresses != null &&addresses != undefined && addresses.length>0){
                        for(var i=0;i<addresses.length;i++){
                            var shipaddress = addresses[i].shipaddress;
                            var billaddress = addresses[i].billaddress;
                            // added by MIBAR on 9/16/2022
                            var country = addresses[i].country;
                            var state = '';
                            // var nexus = '';
                            if (country.indexOf('CA')>=0 || country.indexOf('Canada')>=0 || country.indexOf('canada')>=0){
                                state = canadianProvinceMap[addresses[i].state].name;
                                // nexus = canadianProvinceMap[addresses[i].state].nexus 
                            } else {
                                var state = addresses[i].state
                                // nexus = 
                            };
                            // log.audit('nexus',nexus);

                            //Set our billing address
                            if(billaddress == 'T' || billaddress == true || billaddress == 'true'){
                                var removedRec = objRecord.removeSubrecord({
                                    fieldId: 'billingaddress'
                                });
                                // log.debug('removedBillingRec',JSON.stringify(removedRec));                              
                                var billaddrSubrecord = objRecord.getSubrecord({fieldId: 'billingaddress'});
                                
                                billaddrSubrecord.setValue({fieldId: 'country',value: addresses[i].country});
                                billaddrSubrecord.setValue({fieldId: 'isresidential',value: true });
                                billaddrSubrecord.setValue({fieldId: 'addressee',value: addresses[i].addressee});
                                billaddrSubrecord.setValue({fieldId : 'attention', value : addresses[i].company});

                                /*// added by MIBAR 9-8-2022
                                if(addresses[i].addrphone.length>=7) */billaddrSubrecord.setValue({fieldId: 'addrphone',value: addresses[i].addrphone});
                                
                                billaddrSubrecord.setValue({fieldId: 'addr1',value: addresses[i].addr1});
                                billaddrSubrecord.setValue({fieldId: 'addr2',value: addresses[i].addr2});
                                billaddrSubrecord.setValue({fieldId: 'city',value: addresses[i].city});
                                billaddrSubrecord.setValue({fieldId: 'state',value: state});
                                billaddrSubrecord.setValue({fieldId: 'zip',value: addresses[i].zip});
                            }
                            if(shipaddress =='T' || shipaddress == true || shipaddress =='true'){
                                // Set our shipping address
                                var removedRec = objRecord.removeSubrecord({
                                    fieldId: 'shippingaddress'
                                });
                                
                                objRecord.setValue('shipaddresslist',null);

                                // log.audit('removedShippingRec',JSON.stringify(removedRec));
                                // var shipToCountry = addresses[i].country; 
                                log.debug('country',country);
                                log.emergency('nsAccountId', (nsAccountId.toLowerCase().indexOf('sb')));
                                // RCM add avalara taxing 
                                if(country.toUpperCase().indexOf('CA')>=0 || country.toUpperCase().indexOf('CANADA')>=0){
                                    if(nsAccountId.toLowerCase().indexOf('sb')==-1){
                                        taxItem = TAX_ITEM_CA//334606; // CA tax item    
                                    } else {
                                        taxItem = SB_TAX_ITEM_CA//334606; // CA tax item
                                    }	
                                    subsidiaryId = 18;
                                }else {
                                    if(nsAccountId.toLowerCase().indexOf('sb')==-1){
                                        taxItem = TAX_ITEM//334396; // US tax item    
                                    } else {
                                        taxItem = SB_TAX_ITEM//334396; // US tax item
                                    }	
                                    
                                    subsidiaryId = 18;
                                };
                                /* added nexus handling 4/5/2024 
                                    Netsuite prevents commit of address if nexus changes then redefaults the taxcode from customer file after throwing warning. updating TC then resetting cou
                                */
                                var shipaddrSubrecord = objRecord.getSubrecord({fieldId: 'shippingaddress'});
                                if (shipaddrSubrecord.getValue({fieldId:'country'}) != country){
                                    var updatedCustomer = record.submitFields({
                                        type : record.Type.CUSTOMER,
                                        id : customerNsId,
                                        values : {'taxitem':taxItem}
                                    });
                                    log.debug('updatedCustomer',updatedCustomer)
                                    shipaddrSubrecord.setValue({fieldId: 'country',value: addresses[i].country}); 

                                }
                                shipaddrSubrecord.setValue({fieldId: 'country',value: addresses[i].country});
                                shipaddrSubrecord.setValue({fieldId: 'state',value: state});
                                shipaddrSubrecord.setValue({fieldId: 'zip',value: addresses[i].zip});
                                // shipaddrSubrecord.setValue({fieldId: 'isresidential',value: true});
                                shipaddrSubrecord.setValue({fieldId:'attention' , value: addresses[i].company})
                                shipaddrSubrecord.setValue({fieldId: 'addressee', value: addresses[i].addressee});
                                /*// added by MIBAR 9-8-2022
                                if(addresses[i].addrphone.length>=7)*/ shipaddrSubrecord.setValue({fieldId: 'addrphone',value: addresses[i].addrphone});
                                shipaddrSubrecord.setValue({fieldId: 'addr1',value: addresses[i].addr1});
                                shipaddrSubrecord.setValue({fieldId: 'addr2', value: addresses[i].addr2});
                                shipaddrSubrecord.setValue({fieldId: 'city',value: addresses[i].city});

                            }
                        }
                    };

                    log.debug('taxItem',taxItem);
                    // objRecord.setValue({fieldId : 'taxitem',value : taxItem});
                    // RCM add avalara taxing 
                    objRecord.setValue('custbody_mb_source_inv_tax_amount',externalTaxAmount);
                    objRecord.setValue('custbody_mb_source_invoice_total',receivedJson.total);
    
                    // LPB 2024-04-12: Patch to handle nontaxable customers that entered a taxid in magento. 
                    if(nonProfitTaxId!='' && nonProfitTaxId!=null && externalTaxAmount == 0){
                        var entityUseCode = '';
                        if(nsAccountId.toLowerCase().indexOf('sb')==-1){
                            entityUseCode = taxItem == TAX_ITEM_CA ? CA_EXEMPTION_CODE : US_EXEMPTION_CODE; 
                        } else {
                            entityUseCode = taxItem == SB_TAX_ITEM_CA ? CA_EXEMPTION_CODE : US_EXEMPTION_CODE; 
                        };

                        objRecord.setValue({fieldId:'custbody_ava_shiptousecode',value:entityUseCode});
                        
                    };                    
                    const fieldsToSkip = ['addresses','items','payment_details','isGuest','custbody_tj_external_tax_amount'];
                    const fieldsToSkip1 = ['shipmethod','custbody_mb_is_blind_shipping','custbody_mb_is_sample_order','trandate','class','custbody_mb_order_comments'];

                    for(var i = 0;i<Object.keys(receivedJson).length;i++){
                        if(fieldsToSkip.indexOf(Object.keys(receivedJson)[i]) < 0 ){
                            if(fieldsToSkip1.indexOf(Object.keys(receivedJson)[i]) < 0 ){
                        // if(Object.keys(receivedJson)[i] != 'addresses' && Object.keys(receivedJson)[i] != 'items' && Object.keys(receivedJson)[i] != 'payment_details' && Object.keys(receivedJson)[i] != 'isGuest'){
                        //     if(Object.keys(receivedJson)[i] != 'shipmethod' && Object.keys(receivedJson)[i] != 'custbody_mb_is_blind_shipping' && Object.keys(receivedJson)[i] != 'custbody_mb_is_sample_order' && Object.keys(receivedJson)[i] != 'trandate' && Object.keys(receivedJson)[i] != 'class' && Object.keys(receivedJson)[i] != 'custbody_mb_order_comments'){
                                //log.audit(Object.keys(receivedJson)[i],receivedJson[Object.keys(receivedJson)[i]]);
                                if(receivedJson[Object.keys(receivedJson)[i]])
                                    objRecord.setValue(Object.keys(receivedJson)[i], receivedJson[Object.keys(receivedJson)[i]]);
                            }else{
                                log.debug(Object.keys(receivedJson)[i],receivedJson[Object.keys(receivedJson)[i]])
                                if(receivedJson[Object.keys(receivedJson)[i]]){
                                    if(Object.keys(receivedJson)[i] == 'custbody_mb_order_comments'){
                                        objRecord.setText(Object.keys(receivedJson)[i], receivedJson[Object.keys(receivedJson)[i]]);
                                    }else if(Object.keys(receivedJson)[i] == 'custbody_mb_is_blind_shipping'){
                                        objRecord.setValue(Object.keys(receivedJson)[i], recorrdBooleanCheck(receivedJson[Object.keys(receivedJson)[i]])); 
                                    }else if(Object.keys(receivedJson)[i] == 'trandate'){
                                        objRecord.setText(Object.keys(receivedJson)[i], finalFormat);
                                    }else if(Object.keys(receivedJson)[i] == 'class'){
                                        objRecord.setValue(Object.keys(receivedJson)[i], classValue);
                                        // if(testOrder){
                                            // log.audit('Folders.com testing - setting custom memo');
                                            // objRecord.setValue({fieldId:'memo',value: 'TEST - Folders.com TESTING - DO NOT PROCESS'});
                                        // };
                                    } else if(Object.keys(receivedJson)[i] == 'shipmethod'){
                                        objRecord.setValue('shipcarrier', 'nonups'); 
                                        objRecord.setValue(Object.keys(receivedJson)[i], receivedJson[Object.keys(receivedJson)[i]]); 
                                    } else if(Object.keys(receivedJson)[i] == 'custbody_mb_order_email'){
                                        objRecord.setValue('email',receivedJson[Object.keys(receivedJson)[i]]);
                                        objRecord.setValue(Object.keys(receivedJson)[i], receivedJson[Object.keys(receivedJson)[i]]); 
                                    }

                                }
                            }

                            if (classData == 'cimpress' & receivedJson['custbody_mb_ship_reference_number']!=''){
                                objRecord.setValue('otherrefnum', receivedJson['custbody_mb_ship_reference_number']);
                                objRecord.setValue('memo',"Magento Order #: "+otherrefnum)
                            } else {
                                objRecord.setValue('otherrefnum', otherrefnum);
                            }
                            objRecord.setValue('custbody_mb_merchant_order_id', otherrefnum);

                            objRecord.setValue('custbody_mb_transaction_id', tranid);
                            objRecord.setValue('tranid',tranid)//'1001_'+otherrefnum);
                            if(custbody_braintree_chargedValue)
                                objRecord.setValue('custbody_braintree_charged', custbody_braintree_chargedValue);
                            if(custbody_mb_cc_typeValue)
                                objRecord.setValue('custbody_mb_cc_type', custbody_mb_cc_typeValue);
                            if(paymentMethod || terms){
                               // added by MIBAR 9-20-2022
                               if(paymentMethod =='2' || paymentMethod == 2){
                                   objRecord.setValue('terms','29') // set terms to 'Prepaid - Check' if the order has check as a payment method;
                               } else {
                                   objRecord.setValue('paymentmethod', paymentMethod);
                               }
                               // added by MIBAR 9-26-2023
                               if(terms!='' && terms!=null){
                                    objRecord.setValue('terms',terms);
                               }
                                //added by MIBAR 8-30-2022
                                objRecord.setValue('custbody_mb_payment_method_srch',paymentMethod);
                            } 
                                
                            if(custbody_mb_cc_last4Value)
                                objRecord.setValue('custbody_mb_cc_last4', custbody_mb_cc_last4Value);
                            if(custbody_braintree_idValue)
                                objRecord.setValue('custbody_braintree_id', custbody_braintree_idValue);
                            if(custbody_payment_method_tokenValue)
                                objRecord.setValue('custbody_payment_method_token', custbody_payment_method_tokenValue);
                            // added by MIBAR 8-26-22/Modified by MIBAR 8-30-2022;
                            //if(externalTaxAmount)
                            if(magInternalId && magInternalId!='')
                                objRecord.setValue('custbody_mb_mag_order_internalid',magInternalId)

                           { // Added by Mibar 17/01/2023 Additional info for Amazon Pay.
                               if(AMAZON_PAY.indexOf(paymentMethod) >= 0 ){
                                   objRecord.setValue('custbody_mb_amazon_charge_permissionid',payment_details["custbody_mb_amazon_charge_permissionid"])
                                   objRecord.setValue('custbody_mb_amazon_session_id',payment_details["custbody_mb_amazon_session_id"])
                                   objRecord.setValue('custbody_mb_amazon_transaction_id',payment_details["custbody_mb_amazon_transaction_id"])

                               }
                           
                           }
                        }
                    }
                    // added for shipping discounts; 
                    // /*else if (Object.keys(receivedJson)[i] == 'custbody_mb_ship_amt_discount'){
                    // shipping discount item id: 130435
                    // removed to resolve avatax ship discount issues;  
                    // if (parseFloat(receivedJson.custbody_mb_ship_amt_discount) > 0){
                    //     log.debug('ship discount amt : ', receivedJson.custbody_mb_ship_amt_discount)
                    //     // log.audit('setting ship discount')
                    //     // shipping discount item = 130425
                    //     objRecord.setValue({
                    //         fieldId : 'discountitem',
                    //         value : '130435'
                    //     }); 
                    //     objRecord.setValue({
                    //         fieldId : 'discountrate',
                    //         value : parseFloat((receivedJson.custbody_mb_ship_amt_discount))*-1
                    //     })
                    //     // objRecord.setValue(Object.keys(receivedJson)[i], receivedJson[Object.keys(receivedJson)[i]]); 
                    // }
                // }

                    if(itemDetails != '' && itemDetails != null && itemDetails != undefined){
                        var totalDiscountAmt = 0;
                        var hasSamples = false;
                        for(var i=0;i<itemDetails.length;i++){
                            var amount = 0;
                            log.debug('itemDetails[i].discount_details',itemDetails[i].discount_details);
                            log.emergency('itemDetails[i]',itemDetails[i]);
                            log.debug('itemDetails[i].item',itemDetails[i].item);
                            var sampleOrder = itemDetails[i].custcol_mb_is_sample_item;
                            log.debug('sampleOrder',sampleOrder);
                            var currIndex = objRecord.getCurrentSublistIndex({sublistId: 'item'});
                            log.debug('currIndex',currIndex);
                            objRecord.selectLine({ sublistId: 'item', line: currIndex});
                            var lineId = i+1;
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_line_id',value: lineId});
                            // objRecord.setCurrentSublistValue({sublistId: 'item', fieldId:''})
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'item',value: itemDetails[i].item});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'quantity',value: itemDetails[i].quantity});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'price',value: "-1"}); //  Setting it to Custom Price Level.
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'rate',value: sampleOrder == 'T' ? 0 :  itemDetails[i].rate});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'amount',value: sampleOrder == 'T' ? 0 : itemDetails[i].amount});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_is_sample_item',value:recorrdBooleanCheck(sampleOrder)});
                            if(sampleOrder == 'T'){
                                hasSamples = true;
                            }
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_description',value: itemDetails[i].product_name});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_magento_order_item_id',value: itemDetails[i].magento_order_item_id});
                            
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_merchant_line_item_number',value : lineId});
                            var manualOrder = itemDetails[i].processing_type == "manual" ? true : false
                            log.debug("manualOrder",manualOrder);
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_manual_order',value :manualOrder});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'location',value: locationId});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId : 'taxcode', value :taxItem});
                            var itemId           = itemDetails[i].item;
                            if (itemId == printUpchargeItem){
                                // added by Lucas 11-7-2023
                                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_is_print',value: isPrint == 'T' ? true : false});
                                objRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcolart_option', value: isPrint == 'T' ? 'PRINT' : ''});
                            }
                              // added 12-5-2023 for reprint/vendor comments;
                            if(itemDetails[i].hasOwnProperty('custcol_mb_comments_for_vendor')){
                                objRecord.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_mb_comments_for_vendor',value:itemDetails[i].custcol_mb_comments_for_vendor});
                            }
                            if(itemDetails[i].hasOwnProperty('custcol_mb_is_reprint')){
                                var isReprint = itemDetails[i].custcol_mb_is_reprint == "T" ? true : false;
                                objRecord.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_mb_is_reprint',value:isReprint});
                            }
                            if(itemDetails[i].hasOwnProperty('custcol_mb_reprint_type')){
                                objRecord.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_mb_reprint_type',value:itemDetails[i].custcol_mb_reprint_type});
                            }
                            if(itemDetails[i].hasOwnProperty('custcol_mb_reorder_transaction_num')){
                                objRecord.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_mb_reorder_transaction_num',value:itemDetails[i].custcol_mb_reorder_transaction_num});                            
                            }
                            if(itemDetails[i].hasOwnProperty('custcol_mb_multi_shipto_asset')){
                                objRecord.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_mb_multi_shipto_asset',value:itemDetails[i].custcol_mb_multi_shipto_asset});                            
                            }
                            // end 12-5 changes
                            var magentoOrderId   = itemDetails[i].magento_order_item_id;
                            var discount_details = itemDetails[i].discount_details;
                            
                            if(itemDetails[i].hasOwnProperty("print_details")){// Modifications made by Sai.K
                               var isPrint		      	   = itemDetails[i]["is_print"];
                               var printDetails	  	   = itemDetails[i]["print_details"];
                               log.debug("printDetails",printDetails);
                               var configurationId   	   = printDetails["configurator_id"];
                                //var pdfProofLinks          = printDetails["pdf_proof_links"][0];
                                //var pdfPrintJobLinks  	   = printDetails["pdf_print_job_links"][0];
                                var magentoPrintLinkAdmin  = printDetails["custbody_mb_mag_print_link"];
                                var printStyle		  	   = printDetails["print_style"];
                                var vendorAdder		  	   = printDetails["custcol_mb_adder_vendor"];
                                var adder_Details	  	   = printDetails["adders"];
                               log.debug("adder_Details",adder_Details)
                            }
                            
                            if(discount_details){
                                for(var a=0;a<discount_details.length;a++){
                                          log.debug('discount_details[a]',discount_details.discount_amount);
                                    amount = amount+parseFloat(discount_details[a].discount_amount);
                                }
                            }
                            amount = -1*(amount);
                            log.debug('amount is',amount);
                            if(sampleOrder != 'T'){
                                totalDiscountAmt += (amount*-1);
                            }
                            log.debug("itemDetails[i].hasOwnProperty('print_details')",itemDetails[i].hasOwnProperty("print_details"))
                            if(itemDetails[i].hasOwnProperty("print_details")){// Modifications Made by Sai.k
                               objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_is_print',value: isPrint == 'T' ? true : false});
                               objRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcolart_option', value: isPrint == 'T' ? 'PRINT' : ''});
                               objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_configurator_id',value: configurationId});
                               //objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_pdf_proof_links',value: pdfProofLinks});
                               //objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_pdf_print_job_links',value: pdfPrintJobLinks});
                               objRecord.setCurrentSublistText({sublistId: 'item',fieldId: 'custcol_mb_print_style',text: printStyle});
                               objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_print_vendor',value: vendorAdder});
                               //objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_magento_order_item_id',value: isPrint});
                               objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_mag_print_link',value: magentoPrintLinkAdmin});
                            }

                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_total_discount',value: sampleOrder == 'T' ? 0 : amount});
                            objRecord.commitLine({sublistId: 'item'});
                            var numLinesAfteradding = discountDetails(objRecord,lineId,itemId,discount_details,magentoOrderId,sampleOrder,locationId,taxItem);
                            log.debug("numLinesAfteradding",numLinesAfteradding)

                            if(itemDetails[i].hasOwnProperty("print_details")){// Modifications Made By Sai.k
                                log.debug("Entered","adderDetails")
                               adderDetails(objRecord,itemId,adder_Details,magentoOrderId,sampleOrder,locationId,taxItem)
                            }
                            


                        };
                        // LPB 2024-04-12 - added to handle shipping discount taxability issue w/ Avalara; 

                        if(parseFloat(receivedJson.custbody_mb_ship_amt_discount) > 0){
                            totalDiscountAmt = totalDiscountAmt+parseFloat(receivedJson.custbody_mb_ship_amt_discount)
                            objRecord.selectNewLine({ sublistId: 'item'});
                            var lineId = lineId+1;
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_line_id',value: lineId});
                            // objRecord.setCurrentSublistValue({sublistId: 'item', fieldId:''})
                            var discItem = nsAccountId.toLowerCase().indexOf('sb') == -1 ? SHIPPING_DISC : SB_SHIPPING_DISC;
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'item',value: discItem});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'quantity',value: 1});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'price',value: "-1"}); //  Setting it to Custom Price Level.
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'rate',value: parseFloat(receivedJson.custbody_mb_ship_amt_discount)*-1});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'amount',value: parseFloat(receivedJson.custbody_mb_ship_amt_discount)*-1});
                            
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_merchant_line_item_number',value : lineId});
                            objRecord.setCurrentSublistValue({sublistId:'item', fieldId:'custcol_mb_discount_code',value:receivedJson.custbody_mb_ship_amt_disc_code});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'location',value: locationId});
                            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId : 'taxcode', value :taxItem});
                            objRecord.commitLine({sublistId:'item'});
                        };
                            
                       

                            //Moved & removed by MIBAR 8-28-2022 
                              // objRecord.setValue('discountitem',29677);
                           // log.debug('totalDiscountAmt is',totalDiscountAmt);
                           // objRecord.setValue('discountrate',Number(totalDiscountAmt*-1));
                           //total discount field added by MIBAR 8-28-2022
                    };
                    objRecord.setValue('custbody_mb_inv_header_discount',Number(totalDiscountAmt))
                    if(hasSamples){
                        objRecord.setValue({fieldId:'custbody_sample_line_exist',value:true});
                    };
                    if(receivedJson.shippingcost > 0){
                        objRecord.setValue({fieldId : 'shippingtaxcode',value : taxItem});
                    }

                    recordId = objRecord.save(/*{ignoreMandatoryFields: true}*/);
                    log.debug('recordId is',recordId);
                    

                    if(recordId != null && recordId != ''){
                        // added by MIBAR 8-26-2022;
                        if(depFlag == 'T'){
                            var depositRecId = customerDepositCreation(payment_details,recordId,customerNsId,isGuest,addresses,classValue,receivedJson.total);
                            log.debug('depositRecId is',depositRecId);
                        }
                        var soTotal = search.lookupFields({
                            type: search.Type.SALES_ORDER,id: recordId,
                            columns: 'total'
                        });
                        log.debug('soTotal after submit',soTotal);
                        log.debug('original total', receivedJson.total);
    
                        if(soTotal){
                            soTotal = soTotal.total
                        };
                        // var difference = soTotal-receivedJson.total;
                        // var reviewOrder = if(difference>.001 || difference<.001)
    
                        if (parseFloat(soTotal)!=parseFloat(receivedJson.total).toFixed(2)){
    
                           var submitForApproval = record.submitFields({
                               type : record.Type.SALES_ORDER,
                               id : recordId,
                               values : {'custbody_error_message':'NS order total does not match Magento Order Total - please review'}
                           });
    
                           log.audit('submitForApproval',submitForApproval)
                        };
                        
                        return {
                            'Status': '1',
                            'Internal_ID': recordId,
                            'custombody_mb_transaction_id': tranid,
                            'otherrefnum': otherrefnum,
                            'custbody_mb_cc_last4': custbody_mb_cc_last4Value,
                            'custbody_mb_cc_type': custbody_mb_cc_typeValue
                        };
                    }else{
                      // changed to throw MIBAR 8-26-2022
                        throw {
                            'Status': '0',
                            'Internal_ID': '',
                            'custombody_mb_transaction_id': tranid,
                            'otherrefnum': otherrefnum,
                            'custbody_mb_cc_last4': custbody_mb_cc_last4Value,
                            'custbody_mb_cc_type': custbody_mb_cc_typeValue,
                            '_error' : {
                                'code': 'Error',
                                'message': 'Failed to create Sales Order',
                                'error_severity' : 'High'
                            }
                        };
                    }
                }
            }else{
                log.error('The input JSON is empty');
              // changed to throw MIBAR 8-26-2022
                throw {
                    'Status': '0',
                    'Internal_ID': '',
                    'custombody_mb_transaction_id': '',
                    'otherrefnum': '',
                    'custbody_mb_cc_last4': '',
                    'custbody_mb_cc_type': '',
                    '_error' : {
                        'code': 'Error',
                        'message': 'Request Body is missing.',
                        'error_severity' : 'High'
                    }
                };
            }

        }catch(e){
            log.error('Error in doPost function',JSON.stringify(e));
            var response = {
                    'Status': '0',
                    'Internal_ID': recordId,
                    'custombody_mb_transaction_id': tranid,
                    'otherrefnum': otherrefnum,
                    'custbody_mb_cc_last4': custbody_mb_cc_last4Value,
                    'custbody_mb_cc_type': custbody_mb_cc_typeValue,
                    'error': e.hasOwnProperty('_error') ? e._error : e
            };
          // added by MIBAR 8-26-2022
            throw JSON.stringify(response);
        }

        
        function  emptyFieldsReturnResponse(emptyValueFields){
            var response = {
                    'Status': '0',
                    'Internal_ID': '',
                    'custombody_mb_transaction_id': tranid,
                    'otherrefnum': otherrefnum,
                    'custbody_mb_cc_last4': custbody_mb_cc_last4Value,
                    'custbody_mb_cc_type': custbody_mb_cc_typeValue,
                    '_error' : {
                        'code': 'Error',
                        'message': 'Missing Required Fields '+emptyValueFields.join(',')
                    }
            };
            return response;
        }

    }

    function recorrdBooleanCheck(a){
        if(a == 'T' || a == true || a =='true'){
            return true;
        }else if(a == 'F' || a == false || a == 'false' || a == '' || a == null ){
            return false;
        }
    }

    function discountDetails(objRecord,lineId,itemId,discount_details,magentoOrderId,sampleOrder,locationId,taxItem){
        //var amount= 0
        log.debug('discount_details',discount_details);
        //log.debug('discount_details',JSON.stringify(discount_details));
        for(var i=0;i<discount_details.length;i++){
            var currIndexId = objRecord.getCurrentSublistIndex({sublistId: 'item'});
            //	log.debug('currIndexId',currIndexId);
            objRecord.selectLine({ sublistId: 'item', line: currIndexId});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'item',value: discount_details[i].discount_item});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'price',value: "-1"});
           // rate/amount made negative by MIBAR 8-28-2022;
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'rate',value: sampleOrder == 'T' ? 0 :  (Number(discount_details[i].discount_amount)*-1)});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'amount',value: sampleOrder == 'T' ? 0 : (Number(discount_details[i].discount_amount)*-1)});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_discount_code',value: discount_details[i].discount_code});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_item_link',value: itemId});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_line_id',value: lineId});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_is_sample_item',value:recorrdBooleanCheck(sampleOrder)});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_magento_order_item_id',value: magentoOrderId});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId : 'taxcode', value :taxItem});
            objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'location',value: locationId});
            objRecord.commitLine({sublistId: 'item'});
            var numLines = objRecord.getLineCount({sublistId: 'item'});
        }
        return numLines;
    }

    function customerCreation(payment_details,recordId,internalid,isGuest,addresses,customerEmail,paymentMethod){
        log.debug('custCreation - paymentMethod',paymentMethod);
        log.debug('payment_details is',payment_details);
        log.debug('recordId is',recordId);
        log.debug('depFlag is',depFlag);
        var customerRecordId = '';
        var taxItem = '';
        var subsidiaryId = '';
        var environment = runtime.envType;
        var shipAddress = addresses.filter(function(item){
           if(item.shipaddress=='T'){
               return true;
           } else {
               return false;
           }
        });
        log.debug ('shipAddress',JSON.stringify(shipAddress));

        if (shipAddress.length>0){
           shipAddress= shipAddress[0];
           var shipToCountry = shipAddress.country;
       } else { 
           var shipToCountry = 'US'
       };
        // RCM add avalara taxing 
        if(shipToCountry.indexOf('CA')>=0 || shipToCountry.indexOf('Canada')>=0||shipToCountry.indexOf('canada')>=0){	
            if(nsAccountId.toLowerCase().indexOf('sb')==-1){
                taxItem = TAX_ITEM_CA//334606; // CA tax item    
            } else {
                taxItem = SB_TAX_ITEM_CA//334606; // CA tax item
            }	
            subsidiaryId = 18;
        }else {
            if(nsAccountId.toLowerCase().indexOf('sb')==-1){
                taxItem = TAX_ITEM//334396; // US tax item    
            } else {
                taxItem = SB_TAX_ITEM//334396; // US tax item
            }	
            
            subsidiaryId = 18;
        };

        if(isGuest != 'T' && isGuest != true && isGuest != 'true' && depFlag != 'F'&& depFlag != false && depFlag != 'false' && AMAZON_PAY.indexOf(paymentMethod)<0 && PAYPAL.indexOf(paymentMethod)<0){
            var tokenRecordObj = record.create({type:'customrecord_upybt_multi_token',isDynamic:true });
            tokenRecordObj.setValue('custrecord_upybt_customer',internalid);
            if(custbody_payment_method_tokenValue)
                tokenRecordObj.setValue('custrecord_upybt_token',custbody_payment_method_tokenValue);
            if(custbody_braintree_idValue)
                tokenRecordObj.setValue('custrecord_upybt_braintree_id',custbody_braintree_idValue);
            if(custbody_mb_cc_last4Value)
                tokenRecordObj.setValue('custrecord_cc_number',custbody_mb_cc_last4Value); 
            if(paymentMethod)
                tokenRecordObj.setValue('custrecord_upybt_pmt',paymentMethod);
            var tokenRecordID = tokenRecordObj.save({ignoreMandatoryFields: true});
            log.debug('tokenRecordID is',tokenRecordID);
        }else{
            if(addresses != '' && addresses != null && addresses != undefined ){
                var customerObjRecord = record.create({type: record.Type.CUSTOMER,isDynamic: true });
                var shipaddress = addresses[0].shipaddress;
                var billaddress = addresses[0].billaddress;
                var customerName = addresses[0].addressee;
               /* customerName = customerName.split(' ');
                      log.debug('customerName',customerName)

                var firstName = customerName[0];
                var lastName = customerName[1];*/
              // updated by MIBAR 9-9-2022
               customerName = customerName.split(' ');
               log.debug('customerName: ',customerName);
               log.debug('customername length: ',customerName.length);
                if(customerName.length==2){
                  var firstName = customerName[0];
                  var lastName = customerName[1]; 
                } else if(customerName.length>2){
                  var firstName = customerName.shift();
                  //customerName.shift();
                    log.debug('customerName 2: ',customerName);
                  var lastName = customerName.join(" ");
                } else {
                  var firstName = customerName[0];
                  var lastName = ' ';
                };
                   log.debug('firstName, lastName end',firstName+', '+lastName+' end');
                   log.debug('customerName 3: ',customerName);
              // end updates
                customerObjRecord.setValue('subsidiary', subsidiaryId);
                customerObjRecord.setValue('isperson', 'T');
                customerObjRecord.setValue('firstname',firstName);
                customerObjRecord.setValue('lastname', lastName);
                customerObjRecord.setValue('taxitem', taxItem);
                if(customerEmail)
                    customerObjRecord.setValue('email', customerEmail);
                for(var i=0;i<addresses.length;i++){
                    //Set our billing address
                    if(addresses[i].country.toUpperCase().indexOf('CA')>=0 || addresses[i].country.toUpperCase().indexOf('CANADA')>=0){
                    // RCM add avalara taxing                         
                    //if (taxItem == TAX_ITEM_CA){
                       var state = canadianProvinceMap[addresses[i].state];
                    } else {
                       var state = addresses[i].state;
                    };
                    log.debug('state',state);
                    if(billaddress == 'T' || billaddress == true || billaddress == 'true'){
                        customerObjRecord.selectNewLine({sublistId: 'addressbook'});
                        var billaddrSubrecord = customerObjRecord.getCurrentSublistSubrecord({sublistId: 'addressbook',fieldId: 'addressbookaddress'});
                        billaddrSubrecord.setValue({fieldId: 'country',value: addresses[i].country});
                        billaddrSubrecord.setValue({fieldId: 'isresidential',value: true });
                        billaddrSubrecord.setValue({fieldId: 'addressee',value: addresses[i].addressee});
                       /*// added by MIBAR 9-8-2022
                        if(addresses[i].addrphone.length>=7)*/ 
                        billaddrSubrecord.setValue({fieldId: 'addrphone',value: addresses[i].addrphone});
                        billaddrSubrecord.setValue({fieldId: 'addr1',value: addresses[i].addr1});
                        billaddrSubrecord.setValue({fieldId: 'addr2',value: addresses[i].addr2});
                        billaddrSubrecord.setValue({fieldId: 'city',value: addresses[i].city});
                        billaddrSubrecord.setValue({fieldId: 'state',value: state});
                        billaddrSubrecord.setValue({fieldId: 'zip',value: addresses[i].zip});
                        customerObjRecord.commitLine({sublistId: 'addressbook'});
                    }
                    if(shipaddress == 'T' || shipaddress == true || shipaddress == 'true'){
                        // Set our shipping address
                        customerObjRecord.selectNewLine({sublistId: 'addressbook'});
                        var shipaddrSubrecord = customerObjRecord.getCurrentSublistSubrecord({sublistId: 'addressbook',fieldId: 'addressbookaddress'});
                        shipaddrSubrecord.setValue({fieldId: 'country',value: addresses[i].country});
                        shipaddrSubrecord.setValue({fieldId: 'isresidential',value: true});
                        shipaddrSubrecord.setValue({fieldId: 'addressee', value: addresses[i].addressee});
                        /*// added by MIBAR 9-8-2022
                        if(addresses[i].addrphone.length>=7)*/ 
                        shipaddrSubrecord.setValue({fieldId: 'addrphone',value: addresses[i].addrphone});
                        shipaddrSubrecord.setValue({fieldId: 'addr1',value: addresses[i].addr1});
                        shipaddrSubrecord.setValue({fieldId: 'addr2', value: addresses[i].addr2});
                        shipaddrSubrecord.setValue({fieldId: 'city',value: addresses[i].city});
                        shipaddrSubrecord.setValue({fieldId: 'state',value: state});
                        shipaddrSubrecord.setValue({fieldId: 'zip',value: addresses[i].zip});
                        customerObjRecord.commitLine({sublistId: 'addressbook'});
                    }
                }
                customerRecordId = customerObjRecord.save({ignoreMandatoryFields: true});

                log.debug('customerRecordId is',customerRecordId);
                if(customerRecordId && depFlag != 'F' && depFlag != false && depFlag != 'false' && AMAZON_PAY.indexOf(paymentMethod)<0 && PAYPAL.indexOf(paymentMethod)<0){
                    var tokenRecordObj = record.create({type:'customrecord_upybt_multi_token',isDynamic:true });
                    tokenRecordObj.setValue('custrecord_upybt_customer',customerRecordId);
                    if(custbody_payment_method_tokenValue)
                        tokenRecordObj.setValue('custrecord_upybt_token',custbody_payment_method_tokenValue);
                    if(custbody_braintree_idValue)
                        tokenRecordObj.setValue('custrecord_upybt_braintree_id',custbody_braintree_idValue); 
                    if(custbody_mb_cc_last4Value)
                        tokenRecordObj.setValue('custrecord_cc_number',custbody_mb_cc_last4Value);
                    if(paymentMethod)
                        tokenRecordObj.setValue('custrecord_upybt_pmt',paymentMethod);
                    var tokenRecordID = tokenRecordObj.save({ignoreMandatoryFields: true});
                    log.debug('tokenRecordID is',tokenRecordID);
                }
            }
        }

        return customerRecordId;
    }

    function customerDepositCreation(payment_details,recordId,internalid,isGuest,addresses,_channel,origTotal){
        log.debug('payment_details is',payment_details);
        log.debug('recordId is',recordId);
        var fieldLookUp = search.lookupFields({type: search.Type.SALES_ORDER,id: recordId,columns: ['total', 'trandate','class',]});
        if(parseFloat(fieldLookUp.total)!=parseFloat(origTotal).toFixed(2)){
            log.error('total on SO does not match deposit total')
        };
        var amount = origTotal;//fieldLookUp.total;
        var trandate = fieldLookUp.trandate;
        var channel = _channel;
        log.debug('channel',channel)
        log.debug('amount is',amount);
        //log.debug('trandate is',trandate);
        if(Number(amount) > 0){
            var depositRecordObj = record.create({type: record.Type.CUSTOMER_DEPOSIT, isDynamic:true, defaultValues: {entity: internalid, salesorder:recordId}});
            depositRecordObj.setValue('payment',amount);
            if(channel){
                depositRecordObj.setValue('class',channel);
            }
            if(paymentMethod)
                depositRecordObj.setValue('paymentmethod',paymentMethod); 
            depositRecordObj.setText('trandate',trandate);
            if(custbody_braintree_idValue)
                depositRecordObj.setValue('custbody_braintree_id',custbody_braintree_idValue); 
            depositRecordObj.setValue('custbody_braintree_charged',custbody_braintree_chargedValue);
            if(custbody_payment_method_tokenValue)
                depositRecordObj.setValue('custbody_payment_method_token',custbody_payment_method_tokenValue);
            if(AMAZON_PAY.indexOf(paymentMethod)>=0){
                depositRecordObj.setValue('custbody_mb_amazon_charge_permissionid',payment_details["custbody_mb_amazon_charge_permissionid"])
                depositRecordObj.setValue('custbody_mb_amazon_session_id',payment_details["custbody_mb_amazon_session_id"])
                depositRecordObj.setValue('custbody_mb_amazon_transaction_id',payment_details["custbody_mb_amazon_transaction_id"])

            }
            var depositRecordId = depositRecordObj.save({ignoreMandatoryFields: true});
            //	log.debug('depositRecordId is',depositRecordId);
        }
        return depositRecordId;
    }
    
    function adderDetails(objRecord,itemId,adderDetails,magentoOrderId,sampleOrder,locationId,taxItem){
        try{
            log.debug("adderDetails",adderDetails);
            log.debug("adderDetails length",adderDetails.length);
            for(var i=0;i<adderDetails.length;i++){
                var lineId = i+1;

               log.debug("adderDetails["+i+"]",adderDetails[i]);
                objRecord.selectNewLine({ sublistId: 'item' });
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_line_id'              ,value: i+1				        					  });
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'item'							,value: adderDetails[i].item    					  });
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'quantity'						,value: adderDetails[i].quantity					  });
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'price'						,value: "-1"					  });
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'rate'							,value: sampleOrder == 'T' ? 0 :  adderDetails[i].rate});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'amount'							,value: sampleOrder == 'T' ? 0 : adderDetails[i].amount});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_is_sample_item'		,value:recorrdBooleanCheck(sampleOrder)				   });
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_item_link'			,value: itemId});
                objRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcolart_option', value :'PRINT'});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_magento_order_item_id',value: adderDetails[i].magento_order_item_id});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'location'						,value: locationId});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId : 'taxcode', value :taxItem});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'memo'						    ,value: adderDetails[i].product_name});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_description'						    ,value: adderDetails[i].product_name});
                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_is_print',value: true});

                objRecord.setCurrentSublistValue({sublistId: 'item',fieldId: 'custcol_mb_merchant_line_item_number',value : adderDetails[i].magento_order_item_id});
                objRecord.commitLine({ sublistId: 'item' })

                if(adderDetails[i].hasOwnProperty("discount_details") && adderDetails[i]["discount_details"].length>0){
                    log.debug("Entered","Adders Discount")
                    var numLinesAfteradding = discountDetails(objRecord,lineId,adderDetails[i].item,adderDetails[i]["discount_details"],adderDetails[i].magento_order_item_id,sampleOrder,locationId,taxItem);
                }

            }
        }catch(e){
            log.error("Exception in Adder Details",e);
            throw e;
        }
    }



    return {
        'post': doPost,
    };

});