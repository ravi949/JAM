/* ### ORDERS ### */

const PAID_IN_ADVANCE = 20;             // JAM PAID IN ADVANCE 
const PAID_IN_ADVANCE_BNC = 30;         // bnc SENDS paid IN ADVANCE AS 30 

const TAX_CODE = 334396;                  // 332165;
const TAX_CODE_CA = 334606;
const TAXJAR_EXEMPT = 3; 

const checkEnvType = true;
const envType = nlapiGetContext().getEnvironment();
var useJamSub = function (tranDate){
    return (checkEnvType == true )
}
const BNC_TAX_CODE = 334397;
const BNC_TAX_CODE_CA = 334603;

const CHANNEL_ENVELOPES = 57;
const CHANNEL_FOLDERS = 58;
const CHANNEL_CIMPRESS = 66;

const CIMPRESS_EMAIL = "cimpress@bigname.com" ;
const ENTITY_STATUS = "19";


const BNC_LOCATION = "60"; 
const BNC_SUB = '32';
const HENJ_SUB = '18'
const HENJ_SYR_LOCATION = '94'

const MISSING_ITEM = "99965"; 
const MISSING_DISCOUNT_ITEM = "130637"; 

const CATEGORY = { trade: "19", nonprofit: "12" };

const CUSTOMERS = {
    officeDepot: '10912818',
    staples: '1006276',
    walmart: '16989577'
};

const FEES = {
    quill: '18444',
    officeDepot: '19413',
    staples: '18359',
    walmart: '23162'
};

/**
 * Get record
 * @return {record}
 */
var getRecord = function (type, id) {
    if (id == null) return null;
    return nlapiLoadRecord(type, id)
};

/**
 * Get Order record
 * @return {record}
 */
var getOrderRecord = function (orderId) {
    //TODO: add mainline to this so we dont get 5 records for 1
    var order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('externalid', null, 'is', orderId));
    var newOrderId = null;
    if (order != null) {
        if (order.length > 1) {
            for (i in order) {
                var choice = getRecord(order[i].getRecordType(), order[i].getId());
                if (choice.getFieldValue('externalid') == orderId) {
                    newOrderId = order[i].getId();
                    break;
                }
            }
        } else {
            newOrderId = order[0].getId();
        }
        // nlapiLogExecution('debug','getOrderRecord - orderId 2',newOrderId);
        var salesorder = getRecord('salesorder', newOrderId);
        return salesorder;
    } else {
        nlapiLogExecution('EMERGENCY', 'No SO at 60  ', orderId)
        return null;
    }

};

/**
 * Get Order record
 * @return {record}
 */
var getOrderRecordByExternalId = function (externalId) {
    var orderId = null;
    var order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('externalid', null, 'is', externalId));

    if (order != null && order.length > 1) {
        for (i in order) {
            var choice = getRecord(order[i].getRecordType(), order[i].getId());
            if (choice.getFieldValue('externalid') == externalId) {
                orderId = order[i].getId();
                break;
            }
        }
    } else {
        orderId = order[0].getId();
    }

    return getRecord('salesorder', orderId);
};

/**
 * Get Vendor ID from External ID
 * @return {record}
 */
var getVendorId = function (externalId) {
    var vendorId = null;
    var vendorSearchResult = nlapiSearchRecord('vendor', null, new nlobjSearchFilter('externalid', null, 'is', externalId));

    if (vendorSearchResult != null) {
        if (vendorSearchResult.length > 1) {
            for (i in vendorSearchResult) {
                var choice = getRecord(vendorSearchResult[i].getRecordType(), vendorSearchResult[i].getId());
                if (choice.getFieldValue('externalid') == externalId) {
                    vendorId = vendorSearchResult[i].getId();
                    break;
                }
            }
        } else {
            vendorId = vendorSearchResult[0].getId();
        }
    }
    return vendorId;
};

var createCustomer = function (data) {
    try {
        // Set Customer
        var customerId = findCustomer(data, 'customer').id;
        customerId = addCustomerAndType(data, 'customer', null, customerId).id;

        return { "externalid": customerId, "partyId": data.partyId };
    } catch (err) {
        nlapiLogExecution('Error', 'Error in Create Customer', JSON.stringify(err));
        return ("Error in Create Customer: " + JSON.stringify(err))
    }
}

/**
 * Creates New Order
 * @return {order}
 */
var createOrder = function (data) {
    //nlapiLogExecution("audit","96 about to lookup order ",JSON.stringify(data));    
    try {
        // Make sure order doesnt exist
        var order = null;
        var source; 
        if (typeof data.tranid != 'undefined') {
            source = "tranid";
            order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('tranid', null, 'is', data.tranid));
        } else if (typeof data.externalid != 'undefined') {
            source = "externalid";
            order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('externalid', null, 'is', data.externalid));
        }
        if (order != null) {
            nlapiLogExecution("DEBUG",source,JSON.stringify(order));
            return { 'error': { 'message': 'This record already exists', 'code': 'DUP_RCRD' } };
        }
        // Create record for 'salesorder'

        var isQuoteOrder = false;
        var salesRepId = null;
        nlapiLogExecution("debug", "data.quoteId ", data.quoteId);
        if (typeof data.quoteId != 'undefined' && data.quoteId != null) {
            var estimate = nlapiSearchRecord('estimate', null, new nlobjSearchFilter('tranid', null, 'is', data.quoteId));

            if (estimate != null) {
                isQuoteOrder = true;
                if (estimate.length > 1) {
                    for (i in estimate) {
                        estimate = nlapiLoadRecord('estimate', estimate[i].getId());
                        order = nlapiTransformRecord('estimate', estimate.getId(), 'salesorder');
                        salesRepId = estimate.getFieldValue('salesrep');
                        break;
                    }
                } else {
                    estimate = nlapiLoadRecord('estimate', estimate[0].getId());
                    order = nlapiTransformRecord('estimate', estimate.getId(), 'salesorder');
                    salesRepId = estimate.getFieldValue('salesrep');
                }
            }

            if (order != null) {
                do {
                    order.removeLineItem('item', 1);
                } while (order.getLineItemCount('item') > 0);

                if (typeof data.gclid != 'undefined' && data.gclid != null) {
                    order.setFieldValue('custbodygclid', data.gclid);
                }
                if (typeof data.gsource != 'undefined' && data.gsource != null) {
                    order.setFieldValue('custbodycall_source', data.gsource);
                }
            } else {
                // when an order is null ATM create a new one. 
                nlapiLogExecution("debug", "182 trying to  order create  from quote", data.quoteId);
                order = nlapiCreateRecord('salesorder'                        /*,{recordmode: 'dynamic'}*/);
            }

        } else {
            nlapiLogExecution("debug", "187 trying to  order creat ", "");
            order = nlapiCreateRecord('salesorder'                        /*,{recordmode: 'dynamic'}*/);
        }
        //nlapiLogExecution("audit","146 order created ",JSON.stringify(order)); 

        if (typeof data.customer.webSiteId != 'undefined' && data.customer.webSiteId != null && data.customer.webSiteId != '') {
            if (data.customer.webSiteId == 'envelopes' || data.customer.webSiteId == 'ae') {
                order.setFieldValue('class', CHANNEL_ENVELOPES);
            } else if (data.customer.webSiteId == 'folders') {
                order.setFieldValue('class', CHANNEL_FOLDERS);
                throw 'BOS Folders.com orders integrated to Netsuite after Magento Go-Live cutover must be re-keyed into the Magento interface to be processed.'
            }
        }
        
        if (typeof data.customer.shipping.country != 'undefined' && data.customer.shipping.country == "PR") data.customer.shipping.country = "US";
        if (typeof data.customer.email != 'undefined' && data.customer.email == CIMPRESS_EMAIL) {        
            order.setFieldValue('class', CHANNEL_CIMPRESS);            
        }

        // Set order Transaction ID (uw1nique)
        if (typeof data.tranid != 'undefined') {
            order.setFieldValue('tranid', data.tranid);
        }
        if (typeof data.externalid == 'undefined') {
            order.setFieldValue('externalid', data.tranid);
        } else {
            order.setFieldValue('externalid', data.externalid);
        }

        // Set Customer
        var customerId = findCustomer(data.customer, 'customer').id;
        customerId = addCustomerAndType(data.customer, 'customer', null, customerId,data.tranDate).id;
        nlapiLogExecution("audit", "161 customer ended the customer id is ", customerId);

        if (customerId) 
            var tokenInfo = createToken(data, customerId);
        else{
            var error = nlapiCreateError('BAD_CUST_ERROR', "The SO (~1) could not be stored because create customer (~2) failed.".replace("~1",data.orderId).replace("~2",customerId));
            throw(error);
        }

        if(useJamSub(data.tranDate)){
            nlapiLogExecution("debug", "useJamSub ", customerId);            
            order.setFieldValue('subsidiary', HENJ_SUB); // set sub to HENJ
            order.setFieldValue('location', HENJ_SYR_LOCATION);            
        } else {
            order.setFieldValue('subsidiary', BNC_SUB); // set sub to BNC                 
            order.setFieldValue('location', BNC_LOCATION);
        }               
        order.setFieldValue('entity', customerId);
        // Set order constants
        order.setFieldValue('shipcomplete', 'T');
        order.setFieldValue('tobefaxed', 'F');
        order.setFieldValue('tobeemailed', 'F');
        order.setFieldValue('tobeprinted', 'F');
        order.setFieldValue('source', 'RESTful API');
        // Set order variables
        order.setFieldValue('custbody_brand', data.custbody_brand);
        order.setFieldValue('custbody_comments', data.custbody_comments);
        order.setFieldValue('custbody_printed_or_plain', data.custbody_printed_or_plain);
        order.setFieldValue('custbody_blind_shipment', bToS(data.custbody_blind_shipment));
        order.setFieldValue('custbody_loyalty_points', data.custbody_loyalty_points);
        order.setFieldValue('custbody_rush_production', bToS(data.custbody_rush_production));
        order.setFieldValue('custbody_address_type', data.custbody_address_type);
        order.setFieldValue('custbody_actiual_ship_cost', data.custbody_actual_ship_cost);
        order.setFieldValue('custbody_customer_ship_via', data.custbody_customer_ship_via);
        order.setFieldValue('custbody_order_source', (typeof data.order_source == "undefined") ? "" : data.order_source);
        order.setFieldValue('custbody_channel_cust_id', (typeof data.channel_customer == "undefined") ? "" : data.channel_customer);
        order.setFieldValue('custbody_amazon_order_id', (typeof data.custbody_amazon_order_id == "undefined") ? "" : data.custbody_amazon_order_id);
        order.setFieldValue('custbodystaples_customer_po1', (typeof data.custbodystaples_customer_po1 == "undefined") ? "" : data.custbodystaples_customer_po1);
        order.setFieldValue('otherrefnum', (typeof data.otherrefnum == "undefined") ? "" : data.otherrefnum);
        //    order.setFieldValue('department', (typeof data.department == "undefined") ? "" : data.department); 
        order.setFieldValue('customform', customFormId(data.customform));
        order.setFieldValue('custbodyae_admin_url', (typeof data.custbodyae_admin_url == "undefined") ? "" : data.custbodyae_admin_url);
        order.setFieldValue('custbodycustom_site_order', bToS(data.customSiteOrder));

        order.setFieldValue('shipdate', data.shipdate);
        order.setFieldValue('trandate', data.tranDate);
        order.setFieldValue('istaxable', bToS(data.istaxable));
        order.setFieldValue('custbody_tj_external_tax_amount', data.taxtotal);
  nlapiLogExecution('audit','shipmethod',shippingMethodId(data.shipmethod));
        order.setFieldValue('shipmethod', shippingMethodId(data.shipmethod));
    
    
    
        order.setFieldValue('shippingcost', data.shippingcost);
        //order.setFieldValue('taxtotal', data.taxtotal);
        //order.setFieldValue('taxrate', data.taxrate);        
        

        if (data.customer.shipping.country == "CA"){ 
            if(useJamSub(data.tranDate)){
                var taxItem = TAX_CODE_CA; 
                // if(data.tranid != 'F333596250'){
                    order.setFieldValue('taxitem', TAX_CODE_CA); //data.taxitem // HENJ taxJar CA
                    if (data.shippingcost != 0) order.setFieldValue('shippingtaxcode', TAX_CODE_CA);
                // } else{
                    // nlapiLogExecution('audit','skipping setting taxes for order w issue',data.tranid);
                // }

            } else {
                var taxItem = BNC_TAX_CODE_CA
                // if(data.tranid != 'F333596250'){
                    order.setFieldValue('taxitem', BNC_TAX_CODE_CA); //data.taxitem // BNC taxJar CA
                    if (data.shippingcost != 0) order.setFieldValue('shippingtaxcode', BNC_TAX_CODE_CA);
                // }

            }
            // order.setFieldValue('taxitem', TAX_CODE_CA);
            // taxItem = TAX_CODE_CA;             
            nlapiLogExecution("DEBUG","set CA Taxcode","");
        } else {
            if(useJamSub(data.tranDate)){      
                var taxItem = TAX_CODE; 
                // if(data.tranid != 'F333596250'){
                    order.setFieldValue('taxitem', TAX_CODE); //data.taxitem // HENJ taxJar
                    if (data.shippingcost != 0) order.setFieldValue('shippingtaxcode', TAX_CODE);
                // }
                     
            } else {
                var taxItem = BNC_TAX_CODE
                // if(data.tranid != 'F333596250'){
                    order.setFieldValue('taxitem', BNC_TAX_CODE); //data.taxitem // HENJ taxJar
                    if (data.shippingcost != 0) order.setFieldValue('shippingtaxcode', BNC_TAX_CODE);
                // }
                //order.setFieldValue('taxitem', BNC_TAX_CODE); //data.taxitem // BNC taxJar
            }
        }
        order.setFieldValue('discounttotal', data.discounttotal);
        order.setFieldValue('shippingcost', data.shippingcost);
        order.setFieldValue('custbody_ship_note', (typeof data.shipnote !== 'undefined') ? data.shipnote : '');

        //use order shipping address
        order.setFieldValue('shipaddress', data.customer.shipping.firstname + " " + data.customer.shipping.lastname + "\n" +
            ((typeof data.customer.shipping.companyName == 'undefined' || data.customer.shipping.companyName == null || data.customer.shipping.companyName == "") ? "" : data.customer.shipping.companyName + "\n") +
            ((data.customer.shipping.address1 == null) ? "" : data.customer.shipping.address1 + "\n") +
            ((data.customer.shipping.address2 == null) ? "" : data.customer.shipping.address2 + "\n") +
            ((data.customer.shipping.address3 == null) ? "" : data.customer.shipping.address3 + "\n") +
            data.customer.shipping.city + ", " + data.customer.shipping.state + "  " + data.customer.shipping.zip + "\n" +
            data.customer.shipping.country);

        //order.setFieldValue('shipattention', data.customer.shipping.firstname + " " + data.customer.shipping.lastname);
        order.setFieldValue('shipaddressee', data.customer.shipping.firstname + " " + data.customer.shipping.lastname);        
        
        if (typeof data.customer.shipping.companyName != 'undefined' && data.customer.shipping.companyName != null && data.customer.shipping.companyName != "") {
            order.setFieldValue('companyname', data.customer.shipping.companyName);
            order.setFieldValue('shipcompany', data.customer.shipping.companyName);
            // order.setFieldValue('shipaddressee', data.customer.shipping.companyName);
            order.setFieldValue('shipattention', data.customer.shipping.companyName);
        } else {
            order.setFieldValue('shipcompany', "");
            order.setFieldValue('companyname', "");
            order.setFieldValue('shipattention', "");
        }
        order.setFieldValue('shipaddr1', ((data.customer.shipping.address1 == null) ? "" : data.customer.shipping.address1));
        order.setFieldValue('shipaddr2', ((data.customer.shipping.address2 == null) ? "" : data.customer.shipping.address2));
        order.setFieldValue('shipaddr3', ((data.customer.shipping.address3 == null) ? "" : data.customer.shipping.address3));
        order.setFieldValue('shipcity', ((data.customer.shipping.city == null) ? "" : data.customer.shipping.city));
        order.setFieldValue('shipstate', ((data.customer.shipping.state == null) ? "" : data.customer.shipping.state));
        order.setFieldValue('shipzip', ((data.customer.shipping.zip == null) ? "" : data.customer.shipping.zip));
        order.setFieldValue('shipcountry', ((data.customer.shipping.country == null) ? "" : data.customer.shipping.country));

        var phone = (typeof data.phone == "undefined") ? "" : data.phone.substr(0, 32);
        order.setFieldValue('shipphone', phone);
        order.setFieldValue('phone', phone);
        order.setFieldValue('shipoverride', bToS(true));

        if (typeof data.salesrep != "undefined" && data.salesrep != null) {
            var employeeId = findSalesRep(data, 'employee').id;
            if (employeeId != null) {
                order.setFieldValue('salesrep', employeeId);
            }
        } else {
            order.setFieldValue('salesrep', null);
        }

        if (typeof data.customer.billing !== 'undefined') {
            order.setFieldValue('billaddress', data.customer.billing.firstname + " " + data.customer.billing.lastname + "\n" +
                ((typeof data.customer.billing.companyName == 'undefined' || data.customer.billing.companyName == null || data.customer.billing.companyName == '') ? "" : data.customer.billing.companyName + "\n") +
                ((data.customer.billing.address1 == null) ? "" : data.customer.billing.address1 + "\n") +
                ((data.customer.billing.address2 == null) ? "" : data.customer.billing.address2 + "\n") +
                ((data.customer.billing.address3 == null) ? "" : data.customer.billing.address3 + "\n") +
                data.customer.billing.city + ", " + data.customer.billing.state + "  " + data.customer.billing.zip + "\n" +
                data.customer.billing.country);

            order.setFieldValue('billattention', data.customer.billing.firstname + " " + data.customer.billing.lastname);
            if (typeof data.customer.billing.companyName != 'undefined' && data.customer.billing.companyName != null && data.customer.billing.companyName != '') {
                order.setFieldValue('billcompany', data.customer.billing.companyName);
                order.setFieldValue('billaddressee', data.customer.billing.companyName);
            } else {
                order.setFieldValue('billcompany', "");
                order.setFieldValue('billaddressee', "");
            }
            order.setFieldValue('billaddr1', ((data.customer.billing.address1 == null) ? "" : data.customer.billing.address1));
            order.setFieldValue('billaddr2', ((data.customer.billing.address2 == null) ? "" : data.customer.billing.address2));
            order.setFieldValue('billaddr3', ((data.customer.billing.address3 == null) ? "" : data.customer.billing.address3));
            order.setFieldValue('billcity', ((data.customer.billing.city == null) ? "" : data.customer.billing.city));
            order.setFieldValue('billstate', ((data.customer.billing.state == null) ? "" : data.customer.billing.state));
            order.setFieldValue('billzip', ((data.customer.billing.zip == null) ? "" : data.customer.billing.zip));
            order.setFieldValue('billcountry', ((data.customer.billing.country == null) ? "" : data.customer.billing.country));
            order.setFieldValue('billphone', phone);
        }

        // Add Payment Information
        //order = updatePaymentData(order, data); 

        //staples stuff
        if (typeof data.specialinstructions != 'undefined') {
            order.setFieldValue('custbody_special_instructions', data.specialinstructions);
        }

        // Add items
        for (var i = 0; i < data.items.length; i++) {
            order.insertLineItem('item', i + 1);
// LPB replaced <= 0 with <0 updated 1/18/2023 
            if (parseFloat(data.items[i].amount) < 0)
                order.setLineItemValue('item', 'item', i + 1, findItemById(data.items[i]).id);
                if(order.getLineItemValue('item', 'item', i + 1) == MISSING_ITEM){
                    order.setLineItemValue('item', 'item', i + 1, MISSING_DISCOUNT_ITEM);                    
                }
            else
                order.setLineItemValue('item', 'item', i + 1, findItem(data.items[i]).id);

            if(order.getLineItemValue('item', 'item', i + 1) == MISSING_ITEM || order.getLineItemValue('item', 'item', i + 1) == MISSING_DISCOUNT_ITEM){
                if (typeof data.items[i].sku != 'undefined' && data.items[i].sku != null) {
                    order.setLineItemValue('item', 'custcol_mb_description', i + 1,"Item not found: " + data.items[i].sku);
                }else{
                    order.setLineItemValue('item', 'custcol_mb_description', i + 1,"Item not found (no sku) ");
                }
            }

            order.setLineItemValue('item', 'quantity', i + 1, data.items[i].quantity);
            order.setLineItemValue('item', 'amount', i + 1, data.items[i].amount);
            nlapiLogExecution('audit','taxItem',taxItem);
            order.setLineItemValue('item','taxcode',i + 1, taxItem);      
            if(useJamSub(data.tranDate)){
                order.setLineItemValue('item','location',i + 1,HENJ_SYR_LOCATION);
            } else {
                order.setLineItemValue('item','location',i + 1, BNC_LOCATION);            
            }               
    
            //        order.setLineItemValue('item', 'isCustomQuantity', i+1, data.items[i].isCustomQuantity);
            if (typeof data.customer.webSiteId != 'undefined' && data.customer.webSiteId != null && data.customer.webSiteId != '') {
                if (data.customer.webSiteId == 'envelopes' || data.customer.webSiteId == 'ae') {
                    order.setLineItemValue('item','class',i + 1, CHANNEL_ENVELOPES);                                
                } else if (data.customer.webSiteId == 'folders') {
                    order.setLineItemValue('item','class',i + 1, CHANNEL_FOLDERS);                                                    
                }
                if (typeof data.customer.email != 'undefined' && data.customer.email == CIMPRESS_EMAIL) {        
                    order.setLineItemValue('item','class',i + 1,CHANNEL_CIMPRESS);            
                }
            }    

            var description = data.items[i].name;
            if (typeof data.items[i].printOptions != 'undefined' && data.items[i].printOptions != null) {
                description += '\n';
                description += data.items[i].printOptions;
            }
            if (typeof data.items[i].addOnOptions != 'undefined' && data.items[i].addOnOptions != null) {
                description += data.items[i].addOnOptions;
            }

            if (typeof data.items[i].name != 'undefined') {
                order.setLineItemValue('item', 'description', i + 1, description);
            }
            if (typeof data.items[i].artworkSource != 'undefined' && typeof data.items[i].artworkSource != null) {
                order.setLineItemValue('item', 'custcolart_option', i + 1, data.items[i].artworkSource);
            }
            if (typeof data.items[i].rate != 'undefined' && data.items[i].rate != null) {
                order.setLineItemValue('item', 'rate', i + 1, data.items[i].rate);
            }
            if (typeof data.items[i].isRush != 'undefined' && data.items[i].isRush != null) {
                order.setLineItemValue('item', 'custcol_production_time', i + 1, data.items[i].isRush ? 'Rush' : 'Standard');
            }
            if (typeof data.items[i].approvalDate != 'undefined' && data.items[i].approvalDate != null) {
                order.setLineItemValue('item', 'custcolproof_approval_date', i + 1, data.items[i].approvalDate);
            }
            if (typeof data.items[i].printDate != 'undefined' && data.items[i].printDate != null) {
                order.setLineItemValue('item', 'custcolart_printed', i + 1, data.items[i].printDate);
            }
            if (typeof data.items[i].dueDate != 'undefined' && data.items[i].dueDate != null) {
                order.setLineItemValue('item', 'custcoldue_date', i + 1, data.items[i].dueDate);
            }
            if (typeof data.items[i].s7TemplateId != 'undefined' && data.items[i].s7TemplateId != null) {
                order.setLineItemValue('item', 'custcols7_template', i + 1, data.items[i].s7TemplateId);
            }
            if (typeof data.items[i].seqId != 'undefined' && data.items[i].seqId != null) {
                order.setLineItemValue('item', 'custcol_line_item_sequence', i + 1, data.items[i].seqId);
                order.setLineItemValue('item', 'custcol_mb_merchant_line_item_number', i + 1, data.items[i].seqId);
            }
            if (typeof data.items[i].plateId != 'undefined' && data.items[i].plateId != null) {
                order.setLineItemValue('item', 'custcol_plate_id', i + 1, data.items[i].plateId);
            }
            if (typeof data.items[i].outsourced != 'undefined' && data.items[i].outsourced != null) {
                order.setLineItemValue('item', 'custcol1', i + 1, bToS(data.items[i].outsourced));
            }
            if (typeof data.items[i].syracused != 'undefined' && data.items[i].syracused != null) {
                order.setLineItemValue('item', 'custcol_syracused', i + 1, bToS(data.items[i].syracused));
            }
            if (typeof data.items[i].pressMan != 'undefined' && data.items[i].pressMan != null) {
                order.setLineItemValue('item', 'custcolpressman_2', i + 1, data.items[i].pressMan);
            }
            if (typeof data.items[i].jobDuration != 'undefined' && data.items[i].jobDuration != null) {
                order.setLineItemValue('item', 'custcol26', i + 1, data.items[i].jobDuration);
            }
            if (typeof data.items[i].approvalDuration != 'undefined' && data.items[i].approvalDuration != null) {
                order.setLineItemValue('item', 'custcol_printapprovaltime', i + 1, data.items[i].approvalDuration);
            }
            if (typeof data.items[i].addresses != 'undefined' && data.items[i].addresses != null) {
                order.setLineItemValue('item', 'custcol25', i + 1, data.items[i].addresses);
            }
            if (typeof data.items[i].outsourceVendor != 'undefined' && data.items[i].outsourceVendor != null) {
                order.setLineItemValue('item', 'custcol_vendorname', i + 1, data.items[i].outsourceVendor);
            }
            if (typeof data.items[i].outsourcedBy != 'undefined' && data.items[i].outsourcedBy != null) {
                order.setLineItemValue('item', 'custcol_osdecision', i + 1, data.items[i].outsourcedBy);
            }
            if (typeof data.items[i].syracusedDate != 'undefined' && data.items[i].syracusedDate != null) {
                order.setLineItemValue('item', 'custcol_syracuseddate', i + 1, data.items[i].syracusedDate);
            }
            if (typeof data.items[i].outsourcedDate != 'undefined' && data.items[i].outsourcedDate != null) {
                order.setLineItemValue('item', 'custcol_osdecisiondate', i + 1, data.items[i].outsourcedDate);
            }

            //staples stuff
            if (typeof data.items[i].staplesItemNum != 'undefined') {
                order.setLineItemValue('item', 'custcol_staples_item_number', i + 1, data.items[i].staplesItemNum);
            }
            // this looks like a typo. Cant update a custitem field in an order sublist TTBOMK  ! ! ! 
            // if(typeof data.items[i].channelQty != 'undefined') {
            //     order.setLineItemValue('item', 'custitem_channel_qty', i+1, data.items[i].channelQty);
            // }
            if (typeof data.items[i].staplesDesc != 'undefined') {
                order.setLineItemValue('item', 'custcol_model_description', i + 1, data.items[i].staplesDesc);
            }
            if (typeof data.items[i].staplesUOM != 'undefined') {
                order.setLineItemValue('item', 'custcol_staples_unit_of_measure', i + 1, data.items[i].staplesUOM);
            }
        }

        // Set discount information
        var discountItem = data.discountitem;
        if (discountItem == null && data.discountcode != null) {
            discountItem = findItemById({ "sku": data.discountcode }).id;
            discountItem = discountItem == MISSING_ITEM ? MISSING_DISCOUNT_ITEM : discountItem;             
        }

        order.setFieldValue('discountitem', discountItem);

        //insert record and get order id
        //nlapiLogExecution("debug", "order ", JSON.stringify(order)); 
        var orderId = nlapiSubmitRecord(order, true, true);

        var tranId = null;
        var externalId = null;

        var updateRecord = false;
        order = getRecord('salesorder', orderId);

        if (order != null) {
            if (typeof data.tranid != 'undefined') {
                nlapiLogExecution("debug", "tranid 387 tranid ", data.tranid + "### orderid" + orderId)
                order.setFieldValue('tranid', data.tranid);
            }
            tranId = order.getFieldValue('tranid');
            externalId = order.getFieldValue('externalid');
        }

        var ignoreDeposit = false;
        if (typeof data.closed != 'undefined' && data.closed != null && data.closed) {
            order.setFieldValue('status', 'Closed');
            order.setFieldValue('statusRef', 'closed');
            for (var i = 1; i <= order.getLineItemCount('item'); i++) {
                order.setLineItemValue('item', 'isclosed', i, 'T');
            }
            updateRecord = true;
            ignoreDeposit = true;
        }
        
        if (data.terms == PAID_IN_ADVANCE_BNC && !ignoreDeposit) order.setFieldValue('custbody_braintree_charged', bToS(true));

        if (isQuoteOrder) {
            order.setFieldValue('salesrep', salesRepId);
            //updatePaymentData(order, data);
            updateRecord = true;
        }

        //load order to set terms
        if (data.terms != null || (typeof data.order_prefix != 'undefined' && data.order_prefix != '')) {
            if (data.terms != null) {
                order.setFieldValue('terms', data.terms);
                if (data.terms == PAID_IN_ADVANCE_BNC) {
                    order.setFieldValue('terms', PAID_IN_ADVANCE);
                    order.setFieldValue('paymentmethod', '');
                }
            }
            // add prefix
            if (typeof data.order_prefix != 'undefined' && data.order_prefix != '') {
                order.setFieldValue('tranid', data.order_prefix + order.getFieldValue('tranid'));
            }
            updateRecord = true;
        }

        if (updateRecord) {
            orderId = nlapiSubmitRecord(order, true, true);
            var pm = order.getFieldValue('paymentmethod');
            var term = order.getFieldValue('terms');
            nlapiLogExecution('DEBUG', 'pm  * * term  = ', pm + " ** * " + term)
        }

        if (data.terms == PAID_IN_ADVANCE_BNC && !ignoreDeposit) {
            createDeposit(data);
        }

        return { "orderId": orderId, "tranId": tranId, "externalId": externalId };
    } catch (err) {
        nlapiLogExecution('Error', 'Error in createOrder data = ', JSON.stringify(data))
        nlapiLogExecution('Error', 'Error in createOrder', JSON.stringify(err))
        return err; 
    }
};

// var updateDeposit = function(data){
//     var ignoreDeposit = false;
//     if (typeof data.closed != 'undefined' && data.closed != null && data.closed) {
//         ignoreDeposit = true;
//     }

//     if (data.terms == PAID_IN_ADVANCE_BNC && !ignoreDeposit) {
//         createDeposit(data);
//         return { "orderId ":data.tranid };        
//     }
// }

var updateDeposit = function(indata){

    var orders = indata;
    try {
        var results = new Array();

        for (var index = 0; index < orders.length; index++) {
            var data = orders[index];

            var ignoreDeposit = false;
            if (typeof data.closed != 'undefined' && data.closed != null && data.closed) {
                ignoreDeposit = true;
            }
        
            if (data.terms == PAID_IN_ADVANCE_BNC && !ignoreDeposit) {
                createDeposit(data);
            }
            results.push({ "orderId ":data.tranid });
        }
        nlapiLogExecution('debug','605 results : ',JSON.stringify(results));
    } catch (err) {
        var msg = err.name + " " + err.message;
        var response = {
            "Status": "exception",
            "Message": msg,
        };
        results.push(response);
    }
    return results;
}


var updatePaymentData = function (order, data) {
    //order.setFieldValue('creditcardprocessor', data.creditcardprocessor);
    //order.setFieldValue('ccapproved', bToS(data.ccapproved));
    //order.setFieldValue('getauth', bToS(data.getauth));
    if (data.payment != null) {
        order.setFieldValue('ccstreet', data.payment.ccstreet);
        order.setFieldValue('cczipcode', data.payment.cczipcode);
        //if(data.payment.paymentmethod != "") order.setFieldValue('paymentmethod', data.payment.paymentmethod); // dont set it to blank 
        // terms should be set on these orders no payment methods. 
        order.setFieldValue('ccexpiredate', data.payment.ccexpiredate);
        order.setFieldValue('ccnumber', data.payment.ccnumber);
        order.setFieldValue('pnrefnum', data.payment.referenceNumber);
        //order.setFieldValue('ccsecuritycode', data.payment.ccsecuritycode);
        order.setFieldValue('ccname', data.payment.ccname);
        order.setFieldValue('authcode', data.payment.authCode);
        order.setFieldValue('ccapproved', bToS(data.payment.ccapproved));
        order.setFieldValue('custbody_payment_method_token', data.payment.creditCardToken);
        order.setFieldValue('custbody_braintree_id', data.payment.transactionId);
        order.setFieldValue('custbody_braintree_charged', bToS(false));
    }

    return order;
};

/* UPDATE LINE ITEM */
var updateOrder = function (data) {
    try {
        var order = null;
        var orderId = null;

        if (typeof data.tranid != 'undefined') {
            order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('tranid', null, 'is', data.tranid));
        } else if (typeof data.externalid != 'undefined') {
            order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('externalid', null, 'is', data.externalid));
        }

        if (order != null) {
            if (order.length > 1) {
                for (i in order) {
                    var choice = getRecord(order[i].getRecordType(), order[i].getId());
                    if (choice.getFieldValue('tranid') == data.tranid) {
                        orderId = order[i].getId();
                        break;
                    }
                }
            } else {
                orderId = order[0].getId();
            }
        }

        if (orderId == null) {
            nlapiLogExecution('debug', 'Missing order', data.tranid);
        }
        nlapiLogExecution("audit","730 updateorder  ",JSON.stringify(data));            
        nlapiLogExecution('debug', 'updateOrder 510 ', orderId);
        if (orderId != null) {
            order = getRecord('salesorder', orderId);

            for (var i = 0; i < data.items.length; i++) {
                for (var j = 1; j <= order.getLineItemCount('item'); j++) {
                    if (typeof data.items[i].seqId != 'undefined' && order.getLineItemValue('item', 'custcol_line_item_sequence', j) == data.items[i].seqId) {

                        if (typeof data.items[i].approvalDate != 'undefined') {
                            order.setLineItemValue('item', 'custcolproof_approval_date', j, data.items[i].approvalDate);
                        }
                        if (typeof data.items[i].printDate != 'undefined') {
                            order.setLineItemValue('item', 'custcolart_printed', j, data.items[i].printDate);
                        }
                        if (typeof data.items[i].dueDate != 'undefined') {
                            order.setLineItemValue('item', 'custcoldue_date', j, data.items[i].dueDate);
                        }
                        if (typeof data.items[i].plateId != 'undefined' && data.items[i].plateId != null) {
                            order.setLineItemValue('item', 'custcol_plate_id', i + 1, data.items[i].plateId);
                        }
                        if (typeof data.items[i].outsourced != 'undefined' && data.items[i].outsourced != null) {
                            order.setLineItemValue('item', 'custco1l', i + 1, bToS(data.items[i].outsourced));
                        }
                        if (typeof data.items[i].syracused != 'undefined' && data.items[i].syracused != null) {
                            order.setLineItemValue('item', 'custcol_syracused', i + 1, bToS(data.items[i].syracused));
                        }
                        if (typeof data.items[i].pressMan != 'undefined' && data.items[i].pressMan != null) {
                            order.setLineItemValue('item', 'custcolpressman_2', i + 1, data.items[i].pressMan);
                        }
                        if (typeof data.items[i].jobDuration != 'undefined' && data.items[i].jobDuration != null) {
                            order.setLineItemValue('item', 'custcol26', i + 1, data.items[i].jobDuration);
                        }
                        if (typeof data.items[i].approvalDuration != 'undefined' && data.items[i].approvalDuration != null) {
                            order.setLineItemValue('item', 'custcol_printapprovaltime', i + 1, data.items[i].approvalDuration);
                        }
                        if (typeof data.items[i].addresses != 'undefined' && data.items[i].addresses != null) {
                            order.setLineItemValue('item', 'custcol25', i + 1, data.items[i].addresses);
                        }
                        if (typeof data.items[i].outsourceVendor != 'undefined' && data.items[i].outsourceVendor != null) {
                            order.setLineItemValue('item', 'custcol_vendorname', i + 1, data.items[i].outsourceVendor);
                        }
                        if (typeof data.items[i].outsourcedBy != 'undefined' && data.items[i].outsourcedBy != null) {
                            order.setLineItemValue('item', 'custcol_osdecision', i + 1, data.items[i].outsourcedBy);
                        }
                        if (typeof data.items[i].syracusedDate != 'undefined' && data.items[i].syracusedDate != null) {
                            order.setLineItemValue('item', 'custcol_syracuseddate', i + 1, data.items[i].syracusedDate);
                        }
                        if (typeof data.items[i].outsourcedDate != 'undefined' && data.items[i].outsourcedDate != null) {
                            order.setLineItemValue('item', 'custcol_osdecisiondate', i + 1, data.items[i].outsourcedDate);
                        }
                        if (typeof data.items[i].jobId != 'undefined' && data.items[i].jobId != null) {
                            order.setLineItemValue('item', 'custcol_job_id', i + 1, data.items[i].jobId);
                        }
                        if (typeof data.items[i].stockError != 'undefined' && data.items[i].stockError != null) {
                            order.setLineItemValue('item', 'custcol_osissue', i + 1, data.items[i].stockError);
                            if (order.getLineItemValue('item', 'custcol_osissuedate', i + 1) == null) {
                                order.setLineItemValue('item', 'custcol_osissuedate', i + 1, data.items[i].stockErrorDate);
                            }
                        }
                        if (typeof data.items[i].statusCode != 'undefined' && data.items[i].statusCode != null) {
                            order.setLineItemValue('item', 'custcol35', i + 1, data.items[i].statusCode);
                        }

                    }
                }
            }
            nlapiLogExecution('debug', 'updateOrder 574 ', orderId);
            orderId = nlapiSubmitRecord(order);
        }

        return { "orderId": orderId };
    } catch (err) {
        nlapiLogExecution('debug', 'updateOrder 484 ', JSON.stringify(data));
        nlapiLogExecution('error', 'error in update order', JSON.stringify(err));
        return err; 
    }
};

/**
 * Create an estimate for a quote
 */
var createEstimate = function (data) {
    try {
        nlapiLogExecution('debug', 'createestimate data = ', JSON.stringify(data))
        //find customer or lead
        var customerId = findCustomer(data.customer, 'customer').id;
        if (customerId == null) {
            customerId = findCustomer(data.customer, 'lead').id;
        }

        //if neither exist, create the lead
        customerId = addCustomerAndType(data.customer, 'lead', null, customerId).id;

        // Make sure estimate doesnt exist
        var estimate = null;

        if (typeof data.tranid != 'undefined') {
            estimate = nlapiSearchRecord('estimate', null, new nlobjSearchFilter('tranid', null, 'is', data.tranid));
        }
        if (estimate == null && typeof data.externalid != 'undefined') {
            estimate = nlapiSearchRecord('estimate', null, new nlobjSearchFilter('externalid', null, 'is', data.externalid));
        }

        if (estimate == null) {
            // Create record for 'salesorder'
            estimate = nlapiCreateRecord('estimate');
            estimate.setFieldValue('tranid', data.tranid);
            estimate.setFieldValue('transactionnumber', data.tranid);
            estimate.setFieldValue('externalid', data.tranid);
            estimate.setFieldValue('customform', customFormId(data.customform));

            estimate.setFieldValue('entity', customerId);
            estimate.setFieldValue('entitystatus', ENTITY_STATUS)
            if(useJamSub(data.tranDate)){
                estimate.setFieldValue('subsidiary', HENJ_SUB); // set sub to BNC            
                estimate.setFieldValue('location', HENJ_SYR_LOCATION);    
            }else{
                estimate.setFieldValue('subsidiary', BNC_SUB); // set sub to BNC            
                estimate.setFieldValue('location', BNC_LOCATION);    
            }
            // Set order constants
            estimate.setFieldValue('tobefaxed', 'F');
            estimate.setFieldValue('tobeemailed', 'F');
            estimate.setFieldValue('tobeprinted', 'F');
            estimate.setFieldValue('source', 'RESTful API');

            // Set order variables
            estimate.setFieldValue('custbody_brand', data.custbody_brand);
            estimate.setFieldValue('custbody_address_type', data.custbody_address_type);
            estimate.setFieldValue('custbodyae_admin_url', (typeof data.custbodyae_admin_url == "undefined") ? "" : data.custbodyae_admin_url);
            //estimate.setFieldValue('department', (typeof data.department == "undefined") ? "" : data.department);

            estimate.setFieldValue('trandate', data.tranDate);
            estimate.setFieldValue('istaxable', bToS(data.istaxable));
            estimate.setFieldValue('taxtotal', data.taxtotal);
            estimate.setFieldValue('taxrate', data.taxrate);
            estimate.setFieldValue('taxitem', TAX_CODE); //data.taxitem taxjar
            //estimate.setFieldValue('shipmethod', shippingMethodId(data.shipmethod)); 
            //estimate.setFieldValue('shippingcost', data.shippingcost);

            // Set GCLID for tracking
            if (typeof data.gclid != 'undefined' && data.gclid != null) {
                estimate.setFieldValue('custbodygclid', data.gclid);
            }
            if (typeof data.gsource != 'undefined' && data.gsource != null) {
                estimate.setFieldValue('custbodycall_source', data.gsource);
            }

            //set sales rep
            var employeeId = findSalesRep(data, 'employee').id;
            if (employeeId != null) {
                estimate.setFieldValue('salesrep', employeeId);
            }

            //use estimate shipping address
            estimate.setFieldValue('shipaddress', data.customer.shipping.firstname + " " + data.customer.shipping.lastname + "\n" +
                ((typeof data.customer.shipping.companyName == 'undefined' || data.customer.shipping.companyName == null || data.customer.shipping.companyName == "") ? "" : data.customer.shipping.companyName + "\n") +
                ((data.customer.shipping.address1 == null) ? "" : data.customer.shipping.address1 + "\n") +
                ((data.customer.shipping.address2 == null) ? "" : data.customer.shipping.address2 + "\n") +
                ((data.customer.shipping.address3 == null) ? "" : data.customer.shipping.address3 + "\n") +
                data.customer.shipping.city + ", " + data.customer.shipping.state + "  " + data.customer.shipping.zip + "\n" +
                data.customer.shipping.country);

            //estimate.setFieldValue('shipattention', data.customer.shipping.firstname + " " + data.customer.shipping.lastname);  
            estimate.setFieldValue('shipaddressee', data.customer.shipping.firstname + " " + data.customer.shipping.lastname);        

            if (typeof data.customer.shipping.companyName != 'undefined' && data.customer.shipping.companyName != null && data.customer.shipping.companyName != "") {
                estimate.setFieldValue('companyname', data.customer.shipping.companyName);
                estimate.setFieldValue('shipcompany', data.customer.shipping.companyName);
                estimate.setFieldValue('shipattention', data.customer.shipping.companyName);
            } else {
                estimate.setFieldValue('shipcompany', "");
                estimate.setFieldValue('companyname', "");
                estimate.setFieldValue('shipattention', "");
            }
            estimate.setFieldValue('shipaddr1', ((data.customer.shipping.address1 == null) ? "" : data.customer.shipping.address1));
            estimate.setFieldValue('shipaddr2', ((data.customer.shipping.address2 == null) ? "" : data.customer.shipping.address2));
            estimate.setFieldValue('shipaddr3', ((data.customer.shipping.address3 == null) ? "" : data.customer.shipping.address3));
            estimate.setFieldValue('shipcity', ((data.customer.shipping.city == null) ? "" : data.customer.shipping.city));
            estimate.setFieldValue('shipstate', ((data.customer.shipping.state == null) ? "" : data.customer.shipping.state));
            estimate.setFieldValue('shipzip', ((data.customer.shipping.zip == null) ? "" : data.customer.shipping.zip));
            estimate.setFieldValue('shipcountry', ((data.customer.shipping.country == null) ? "" : data.customer.shipping.country));
            var phone = (typeof data.phone == "undefined") ? "" : data.phone.substr(0, 32);
            estimate.setFieldValue('shipphone', phone);
            estimate.setFieldValue('phone', phone);
            estimate.setFieldValue('shipoverride', bToS(true));

            //use estimate billing address
            if (data.customer.shipping.country == "CA"){ 
                if(useJamSub(data.tranDate)){                                    
                    estimate.setFieldValue('taxitem', TAX_CODE_CA); //data.taxitem // HENJ taxJar CA
                    var taxItem = TAX_CODE_CA; 
                    if (data.shippingcost != 0) estimate.setFieldValue('shippingtaxcode', TAX_CODE_CA);
    
                } else {
                    estimate.setFieldValue('taxitem', BNC_TAX_CODE_CA); //data.taxitem // BNC taxJar CA
                    var taxItem = BNC_TAX_CODE_CA
                    if (data.shippingcost != 0) estimate.setFieldValue('shippingtaxcode', BNC_TAX_CODE_CA);
    
                }
                // order.setFieldValue('taxitem', TAX_CODE_CA);
                // taxItem = TAX_CODE_CA;             
                nlapiLogExecution("DEBUG","set CA Taxcode","");
            } else {
                if(useJamSub(data.tranDate)){    
                    var taxItem = TAX_CODE;                                 
                    estimate.setFieldValue('taxitem', TAX_CODE); //data.taxitem // HENJ taxJar CA
                    if (data.shippingcost != 0) estimate.setFieldValue('shippingtaxcode', taxItem);
    
                } else {
                    var taxItem = BNC_TAX_CODE
                    estimate.setFieldValue('taxitem', BNC_TAX_CODE); //data.taxitem // BNC taxJar CA
                    if (data.shippingcost != 0) estimate.setFieldValue('shippingtaxcode', taxItem);
    
                };
            }

            //use estimate billing address
            if (typeof data.customer.billing !== 'undefined') {
                estimate.setFieldValue('billaddress', data.customer.billing.firstname + " " + data.customer.billing.lastname + "\n" +
                    ((typeof data.customer.billing.companyName == 'undefined' || data.customer.billing.companyName == null || data.customer.billing.companyName == '') ? "" : data.customer.billing.companyName + "\n") +
                    ((data.customer.billing.address1 == null) ? "" : data.customer.billing.address1 + "\n") +
                    ((data.customer.billing.address2 == null) ? "" : data.customer.billing.address2 + "\n") +
                    ((data.customer.billing.address3 == null) ? "" : data.customer.billing.address3 + "\n") +
                    data.customer.billing.city + ", " + data.customer.billing.state + "  " + data.customer.billing.zip + "\n" +
                    data.customer.billing.country);

                estimate.setFieldValue('billattention', data.customer.billing.firstname + " " + data.customer.billing.lastname);
                if (typeof data.customer.billing.companyName != 'undefined' && data.customer.billing.companyName != null && data.customer.billing.companyName != '') {
                    estimate.setFieldValue('billcompany', data.customer.billing.companyName);
                    estimate.setFieldValue('billaddressee', data.customer.billing.companyName);
                } else {
                    estimate.setFieldValue('billcompany', "");
                    estimate.setFieldValue('billaddressee', "");
                }
                estimate.setFieldValue('billaddr1', ((data.customer.billing.address1 == null) ? "" : data.customer.billing.address1));
                estimate.setFieldValue('billaddr2', ((data.customer.billing.address2 == null) ? "" : data.customer.billing.address2));
                estimate.setFieldValue('billaddr3', ((data.customer.billing.address3 == null) ? "" : data.customer.billing.address3));
                estimate.setFieldValue('billcity', ((data.customer.billing.city == null) ? "" : data.customer.billing.city));
                estimate.setFieldValue('billstate', ((data.customer.billing.state == null) ? "" : data.customer.billing.state));
                estimate.setFieldValue('billzip', ((data.customer.billing.zip == null) ? "" : data.customer.billing.zip));
                estimate.setFieldValue('billcountry', ((data.customer.billing.country == null) ? "" : data.customer.billing.country));
                estimate.setFieldValue('billphone', phone);
            }

            // Add items
            for (var i = 0; i < data.items.length; i++) {
                estimate.insertLineItem('item', i + 1);

                if (parseFloat(data.items[i].amount) <= 0)
                    estimate.setLineItemValue('item', 'item', i + 1, findItemById(data.items[i]).id);
                    if(estimate.getLineItemValue('item', 'item', i + 1) == MISSING_ITEM){
                        estimate.setLineItemValue('item', 'item', i + 1, MISSING_DISCOUNT_ITEM);                    
                    }
                else
                    estimate.setLineItemValue('item', 'item', i + 1, findItem(data.items[i]).id);
    
                if(estimate.getLineItemValue('item', 'item', i + 1) == MISSING_ITEM || estimate.getLineItemValue('item', 'item', i + 1) == MISSING_DISCOUNT_ITEM){
                    if (typeof data.items[i].sku != 'undefined' && data.items[i].sku != null) {
                        estimate.setLineItemValue('item', 'custcol_mb_description', i + 1,"Item not found: " + data.items[i].sku);
                    }else{
                        estimate.setLineItemValue('item', 'custcol_mb_description', i + 1,"Item not found (no sku) ");
                    }
                }
    

                estimate.setLineItemValue('item', 'quantity', i + 1, data.items[i].quantity);
                estimate.setLineItemValue('item', 'amount', i + 1, data.items[i].amount);
                estimate.setLineItemValue('item', 'rate', i + 1, data.items[i].rate);
                estimate.setLineItemValue('item','taxcode',i + 1, taxItem);      
                estimate.setLineItemValue('item', 'custcol_line_item_sequence', i + 1, data.items[i].seqId);
                estimate.setLineItemValue('item', 'custcol_mb_merchant_line_item_number', i + 1, data.items[i].seqId);        

                var description = '';
                if (typeof data.items[i].name != 'undefined' && data.items[i].name != null) {
                    description += data.items[i].name + '\n';
                }
                if (typeof data.items[i].printOptions != 'undefined' && data.items[i].printOptions != null) {
                    description += data.items[i].printOptions;
                }
                if (typeof data.items[i].addOnOptions != 'undefined' && data.items[i].addOnOptions != null) {
                    description += data.items[i].addOnOptions;
                }
                estimate.setLineItemValue('item', 'description', i + 1, description);
            }
        } else {
            if (estimate != null) {
                if (estimate.length > 1) {
                    for (i in estimate) {
                        var choice = getRecord(estimate[i].getRecordType(), estimate[i].getId());
                        if (choice.getFieldValue('externalid') == data.externalid) {
                            estimate = choice;
                            break;
                        }
                    }
                } else {
                    estimate = getRecord(estimate[0].getRecordType(), estimate[0].getId());
                }

                var existingQuotes = {};
                for (var i = 1; i <= estimate.getLineItemCount('item'); i++) {
                    existingQuotes[estimate.getLineItemValue('item', 'custcol_line_item_sequence', i)] = estimate.getLineItemValue('item', 'custcol_line_item_sequence', i);
                }

                var itemIndex = estimate.getLineItemCount('item');
                for (var i = 0; i < data.items.length; i++) {
                    if (typeof existingQuotes[data.items[i].seqId] == 'undefined') {
                        itemIndex++;
                        estimate.insertLineItem('item', itemIndex);

                        if (parseFloat(data.items[i].amount) <= 0)
                            estimate.setLineItemValue('item', 'item', itemIndex, findItemById(data.items[i]).id);
                            if(estimate.getLineItemValue('item', 'item', itemIndex) == MISSING_ITEM){
                                estimate.setLineItemValue('item', 'item', itemIndex, MISSING_DISCOUNT_ITEM);                    
                            }
                        else
                            estimate.setLineItemValue('item', 'item', itemIndex, findItem(data.items[i]).id);
            
                        if(estimate.getLineItemValue('item', 'item', itemIndex) == MISSING_ITEM || estimate.getLineItemValue('item', 'item', itemIndex) == MISSING_DISCOUNT_ITEM){
                            if (typeof data.items[i].sku != 'undefined' && data.items[i].sku != null) {
                                estimate.setLineItemValue('item', 'custcol_mb_description', itemIndex,"Item not found: " + data.items[i].sku);
                            }else{
                                estimate.setLineItemValue('item', 'custcol_mb_description', itemIndex,"Item not found (no sku) ");
                            }
                        }
        

                        estimate.setLineItemValue('item', 'quantity', itemIndex, data.items[i].quantity);
                        estimate.setLineItemValue('item', 'amount', itemIndex, data.items[i].amount);
                        estimate.setLineItemValue('item', 'rate', itemIndex, data.items[i].rate);
                        estimate.setLineItemValue('item', 'custcol_line_item_sequence', itemIndex, data.items[i].seqId);

                        var description = '';
                        if (typeof data.items[i].name != 'undefined' && data.items[i].name != null) {
                            description += data.items[i].name + '\n';
                        }
                        if (typeof data.items[i].printOptions != 'undefined' && data.items[i].printOptions != null) {
                            description += data.items[i].printOptions;
                        }
                        if (typeof data.items[i].addOnOptions != 'undefined' && data.items[i].addOnOptions != null) {
                            description += data.items[i].addOnOptions;
                        }
                        estimate.setLineItemValue('item', 'description', itemIndex, description);
                    }
                }
            }
        }
        
        //insert record and get estimate id
        var estimateId = nlapiSubmitRecord(estimate);

        return { "estimateId" : estimateId };

    } catch (err) {
        nlapiLogExecution('Error', 'Error in createestimate data = ', JSON.stringify(data))
        nlapiLogExecution('error', 'error in create estimate', JSON.stringify(err));
        return err; 
    }
};

/* ### ITEMS ### */

/**
 * Find Item
 * @params {partyId}
 * @return {customerId} or null
 */
var findItem = function (data) {
    //var item = nlapiSearchRecord('item', null, [new nlobjSearchFilter('itemid',null,'is',data.sku), new nlobjSearchFilter('isinactive',null,'is','F')]);
    var item = nlapiSearchRecord('item', null, [new nlobjSearchFilter('custitem_mb_bnc_item_id_nopar', null, 'is', data.sku), new nlobjSearchFilter('isinactive', null, 'is', 'F')]);
    if (item == null) {
        return findItemById(data); 
        //return { "id": null };

    } else {
        if (item.length > 1) {
            for (i in item) {
                var choice = getRecord(item[i].getRecordType(), item[i].getId());
                if (choice.getFieldValue('custitem_mb_bnc_item_id_nopar') == data.sku) {
                    return { "id": item[i].getId() };
                }
            }
            return findItemById(data);             
            //return { "id": null };
        } else {
            return { "id": item[0].getId() };
        }
    }
};

/* ### ITEMS ### */

/**
 * Find Item by Id 
 * @params {partyId}
 * @return {customerId} or null
 */
var findItemById = function (data) {
    var item = nlapiSearchRecord('item', null, [new nlobjSearchFilter('itemid', null, 'is', data.sku), new nlobjSearchFilter('isinactive', null, 'is', 'F')]);
    if (item == null) {
        return { "id": MISSING_ITEM };
    } else {
        if (item.length > 1) {
            for (i in item) {
                var choice = getRecord(item[i].getRecordType(), item[i].getId());
                if (choice.getFieldValue('itemid') == data.sku) {
                    return { "id": item[i].getId() };
                }
            }
            return { "id": MISSING_ITEM };
        } else {
            return { "id": item[0].getId() };
        }
    }
};

/* ### CUSTOMERS ### */

/**
 * Find Customer
 * @params {partyId}
 * @return {customerId} or null
 */
var findCustomer = function (data, type) {
    var customer = nlapiSearchRecord(type, null, new nlobjSearchFilter('custentity_mb_bos_party_id', null, 'is', data.partyId));
    if (customer == null) {
        return { "id": null };
    } else {
        return { "id": customer[0].getId() };
    }

};

/**
 * Find Customer
 * @params {partyId}
 * @return {customerId} or null
 */
var findSalesRep = function (data, type) {
    var employee = nlapiSearchRecord(type, null, new nlobjSearchFilter('email', null, 'is', data.salesrep));
    if (employee == null) {
        return { "id": null };
    } else {
        return { "id": employee[0].getId() };
    }
};

/**
 * Add Customer
 * @params data({firstname}, {lastname}, {email}, {phone}, {partyId}, {companyName}, {billAddress}, {shipAddress})
 * @return {customerId} or null
 */
var addLead = function (data) {
    return addCustomerAndType(data, 'lead', null, null);
};
var addCustomerAndType = function (data, type, customer, id,tranDate) {
    try {
        if (id != null && typeof data.ignoreupdate != 'undefined' && data.ignoreupdate != null && data.ignoreupdate) {
            return { "id": id };
        }

        var newRecord = false;
        if (customer == null && id == null) {
            customer = nlapiCreateRecord(type);
            newRecord = true;
        } else if (customer == null && id != null && id != '') {
            customer = getRecord(type, id);
        } //else customer is not null and should proceed below

        // Set customer
        if (newRecord) {
            // checkDate to see customer sub
            if(useJamSub(tranDate)){
                customer.setFieldValue('subsidiary', HENJ_SUB); // set sub to HENJ
            } else {
                customer.setFieldValue('subsidiary', BNC_SUB); // set sub to BNC
            }
            //if(tranDate>=new Date())
            customer.setFieldValue('custentity_mb_bos_party_id', data.partyId); // new Custom field for BOS ID
            customer.setFieldValue('currency', '1');
            if (typeof data.lastname != 'undefined' && data.lastname != null && data.lastname != '') {
                customer.setFieldValue('lastname', data.lastname.substr(0, 32));
                if(typeof data.firstname == 'undefined' || data.firstname == null || data.firstname == '') data.firstname = "."; 
                customer.setFieldValue('firstname', data.firstname.substr(0, 32));
                customer.setFieldValue('entityid', data.firstname.substr(0, 32) + ' ' + data.lastname.substr(0, 32) + ' (' + data.partyId + ')')
            }
            if (typeof data.email != 'undefined' && data.email != null && data.email != '') {
                customer.setFieldValue('email', data.email);
            }
            customer.setFieldValue('externalid', data.partyId);

            if (typeof data.resellerId != 'undefined' && data.resellerId != null && data.resellerId != '') {
                customer.setFieldValue('resalenumber', data.resellerId.substr(0, 20));
            }

            if (typeof data.companyName != 'undefined' && data.companyName == ' ') data.companyName = null;

            if (typeof data.companyName != 'undefined' && data.companyName != null && data.companyName != '') {
                customer.setFieldValue('companyname', data.companyName);
                customer.setFieldValue('isperson', 'F');
            } else {
                customer.setFieldValue('isperson', 'T');
            }

            if (typeof data.phone != 'undefined' && data.phone != null && data.phone != '') {
                if(data.phone.length >=10) customer.setFieldValue('phone', data.phone.substr(0, 32));
            }

            if (typeof data.swatchbook != 'undefined' && data.swatchbook) {
                customer.setFieldValue('custentityswatchbook_truefalse', bToS(data.swatchbook));
            }
            if (typeof data.swatchbookDate != 'undefined') {
                customer.setFieldValue('custentitybought_swatchbook', data.swatchbookDate);
            }

            //set customer channel
            if (typeof data.webSiteId != 'undefined' && data.webSiteId != null && data.webSiteId != '') {
                if (data.webSiteId == 'envelopes' || data.webSiteId == 'ae') {
                    customer.setFieldValue('custentityenvelopes_customer', 'T');
                } else if (data.webSiteId == 'folders') {
                    customer.setFieldValue('custentityfolders_customer', 'T');
                }
            }
        } else {
            customer.setFieldValue('externalid', data.partyId);
        }

        if ((typeof data.isTrade != 'undefined' && data.isTrade != null && data.isTrade != '' && data.isTrade) || (typeof data.isNonProfit != 'undefined' && data.isNonProfit != null && data.isNonProfit != '' && data.isNonProfit)) {
            if (typeof data.isTrade != 'undefined' && data.isTrade != null && data.isTrade != '' && data.isTrade) {
                customer.setFieldValue('category', CATEGORY.trade);
                customer.setFieldValue('custentity_trade_acct', 'T');
            } else if (typeof data.isNonProfit != 'undefined' && data.isNonProfit != null && data.isNonProfit != '' && data.isNonProfit) {
                customer.setFieldValue('category', CATEGORY.nonprofit);// changed by mibar for JAM Mapping
            }
        } else {
            customer.setFieldValue('category', null);
        }

        if (typeof data.isNonTaxable != 'undefined' && data.isNonTaxable != null && data.isNonTaxable != '' && data.isNonTaxable) {
            customer.setFieldValue('taxable', 'F');
            customer.setFieldValue('custentity_tj_exempt_customer_type',TAXJAR_EXEMPT); 
            customer.setFieldValue('custentity_tj_exempt_customer','T');
            //        customer.setFieldValue('custentity_ava_exemptcertno', 'Exempt'); - to be replaced by taxJar
        } else {
            customer.setFieldValue('taxable', 'T');
            //        customer.setFieldValue('custentity_ava_exemptcertno', null); - to be replaced by TaxJar
        }
        if(useJamSub(tranDate)){            
            // set tax code to HENJ TAX CODE
            customer.setFieldValue('taxitem', TAX_CODE);
        } else {
            customer.setFieldValue('taxitem', BNC_TAX_CODE); // set tax to BNC Tax CODE
        }
        
        nlapiLogExecution("DEBUG", "data.customer", JSON.stringify(data));
        if (typeof data.billing != 'undefined')
            if (typeof data.billing.country != 'undefined' && data.billing.country == "CA") { 
                if(useJamSub(tranDate)){            
                    // set tax code to HENJ TAX CODE
                    customer.setFieldValue('taxitem', TAX_CODE_CA);
                } else {
                    customer.setFieldValue('taxitem', BNC_TAX_CODE_CA); // set tax to BNC Tax CODE
                }
            }
        
        //insert record and get customer id
        var customerId = nlapiSubmitRecord(customer);
        nlapiLogExecution('debug', 'Customer added ' + customerId);

        return { "id": customerId };
    } catch (err) {
        nlapiLogExecution('error', 'error in addCustomerandType', JSON.stringify(err));
        return { "id": null};        
    }
};

/* ### INVENTORY ### */
/**
 * Get Inventory
 * @params data()
 * @return [{itemid, qty}] or []
 */
 var getInventory = function (data) {
    try{
        var loadSearch = nlapiLoadSearch('item', 'customsearch_bnc_211');
        var _columns = loadSearch.getColumns();
        var searchResults = loadSearch.runSearch();
        var resultIndex = parseFloat(data.startingIndex);
      var endIndex = resultIndex+999;
        var response = [];
  
        do {
             // nlapiLogExecution('debug','startingIndex',resultIndex);
      //nlapiLogExecution('debug','endIndex',endIndex);
  
            var chunk = searchResults.getResults(resultIndex, endIndex);
            if (chunk.length>0) _columns = chunk[0].getAllColumns();
            for (var i in chunk) {
                var obj = new Object();
                var res = chunk[i];
                obj = {
                    "itemid": res.getValue(_columns[2]),
                    //"qty": chunk[i].getValue(_columns[4]), // needs to be swapped out
                    "locationqty": res.getValue('locationquanityavailable'),
                    "locationbackordered": res.getValue('locationquantitybackordered'),// needs to be swapped out
                    // add inactive/active flag
                    "qtyavailable" : res.getValue(_columns[4]),
                    "isavailable" : res.getValue(_columns[5]),
                    "desc": res.getValue('displayname'),
                    "dropship": res.getText('custrecord_mb_ip_dropship_status','custitem_mb_linked_item_attribute'),
                   // "dropshipOnly": chunk[i].getValue('custitem_drop_ship_only'),
                    "reorderMultiple": res.getValue('reordermultiple'),
                    "location": res.getValue('custitem_location'),
                    "eachcount": res.getValue('custitem_each_count')
                }
                response.push(obj);
                resultIndex++;
            }
        } while (chunk.length >= 1000);
        return response;
    } catch(err){
      nlapiLogExecution('error','error',JSON.stringify(err))
      return {error : JSON.stringify(err)};
    }
  };
/* ### GET ALL ITEM COSTS */
/**
 * Get all item costs
 * @params data
 * @return {}
 */
var getItemAverageCost = function (data) {
    var loadSearch = nlapiLoadSearch('item', 'customsearch_bnc_835');
    var searchResults = loadSearch.runSearch();
    var resultIndex = 0;
    var response = [];
    do {
        var chunk = searchResults.getResults(resultIndex, resultIndex + 1000);
        for (var i in chunk) {
            response.push({
                "sku": (((chunk[i].getValue('itemid')).indexOf(':') != -1) ? (chunk[i].getValue('itemid')).substring((chunk[i].getValue('itemid')).indexOf(':') + 1) : chunk[i].getValue('itemid')).trim(),
                "averageCost": chunk[i].getValue('averagecost')
            });
            resultIndex++;
        }
    } while (chunk.length >= 1000);

    return response;
};

/* ### GET ALL ITEM WORKORDERS */
/**
 * Get all item costs
 * @params data
 * @return {}
 */
var getItemWorkOrder = function (data) {
    var loadSearch = nlapiLoadSearch('workorder', 'customsearch_bnc_132');
    var searchResults = loadSearch.runSearch();
    var resultIndex = 0;
    var response = [];
    do {
        var chunk = searchResults.getResults(resultIndex, resultIndex + 1000);
        for (var i in chunk) {
            response.push({
                "productid": (((chunk[i].getText('item')).indexOf(':') != -1) ? (chunk[i].getText('item')).substring((chunk[i].getText('item')).indexOf(':') + 1) : chunk[i].getText('item')).trim(),
                "workorderid": chunk[i].getValue('tranid')
            });
            resultIndex++;
        }
    } while (chunk.length >= 1000);

    return response;
};

var getWorkOrder = function (data) {
    var woData = {};
    var workOrders = nlapiSearchRecord('workorder', null, [new nlobjSearchFilter('tranid', null, 'is', data.id)]);
    if (typeof workOrders != 'undefined' && workOrders != null && workOrders.length > 0) {
        var workOrder = getRecord('workorder', workOrders[0].id);

        if (typeof workOrder != 'undefined' && workOrder != null) {
            var totalQty = 0;
            for (var j = 1; j <= workOrder.getLineItemCount('item'); j++) {
                if (workOrder.getLineItemValue('item', 'item_display', j).toLowerCase().indexOf("sheets") != -1) {
                    totalQty = totalQty + parseFloat(workOrder.getLineItemValue('item', 'quantity', j));
                }
            }

            woData['internalId'] = workOrder.getFieldValue('id');
            woData['id'] = workOrder.getFieldValue('tranid');
            woData['date'] = workOrder.getFieldValue('createddate');
            woData['quantity'] = workOrder.getFieldValue('quantity');
            woData['assembly'] = workOrder.getFieldValue('custbody_assemblydescription');
            woData['sku'] = workOrder.getFieldValue('custbody_assemblysku');
            woData['sealingMethod'] = workOrder.getFieldValue('custbody_sealing_method');
            woData['memo'] = workOrder.getFieldValue('memo');
            woData['status'] = workOrder.getFieldValue('status');

            woData['qtyToPull'] = Math.ceil(totalQty);
            woData['pulledQty'] = workOrder.getFieldValue('custbody_wo_paperqtypulled');
            woData['pulledIssues'] = workOrder.getFieldValue('custbody_wo_paperqtypullissue');
            woData['pulledBy'] = workOrder.getFieldValue('custbody8');
            woData['cutBy'] = workOrder.getFieldValue('custbody9');

            if (typeof data.update != 'undefined' && bToS(data.update)) {
                if (typeof data.pulledQty != 'undefined' && data.pulledQty != '') {
                    workOrder.setFieldValue('custbody_wo_paperqtypulled', data.pulledQty);
                }
                if (typeof data.pulledIssues != 'undefined' && data.pulledIssues != '') {
                    workOrder.setFieldValue('custbody_wo_paperqtypullissue', data.pulledIssues);
                }
                if (typeof data.pulledBy != 'undefined' && data.pulledBy != '') {
                    if (data.pulledBy.indexOf(',') != -1) {
                        workOrder.setFieldValues('custbody8', data.pulledBy.split(','));
                    } else {
                        workOrder.setFieldValue('custbody8', data.pulledBy);
                    }
                    workOrder.setFieldValue('custbody_wo_datetimepulled', data.pulledDate);
                }
                if (typeof data.cutBy != 'undefined' && data.cutBy != '') {
                    if (data.cutBy.indexOf(',') != -1) {
                        workOrder.setFieldValues('custbody9', data.cutBy.split(','));
                    } else {
                        workOrder.setFieldValue('custbody9', data.cutBy);
                    }
                    workOrder.setFieldValue('custbody_wo_datetimecut', data.cutDate);
                }

                var workOrderInternalId = nlapiSubmitRecord(workOrder);
                delete data['update'];
                return getWorkOrder(data);
            }
        }
    }

    return woData;
};

/**
 * Get Sales for Channel
 * @params data
 * @return {}
 */
var getChannelSales = function (data) {
    var loadSearch = nlapiLoadSearch('transaction', 'customsearch_channel_order_report');
    var searchResults = loadSearch.runSearch();
    var resultIndex = 0;
    var response = [];
    do {
        var chunk = searchResults.getResults(resultIndex, resultIndex + 1000);
        for (var i in chunk) {
            response.push({
                "name": chunk[i].getValue('entityid', 'customer'),
                "datecreated": chunk[i].getValue('datecreated'),
                "date": chunk[i].getValue('trandate'),
                "orderid": (chunk[i].getValue('transactionname')).replace('Sales Order #', '')
            });
            resultIndex++;
        }
    } while (chunk.length >= 1000);

    return response;
};

/* ### GET ALL FULFILLMENTS */
/**
 * Get Tracking
 * @params data
 * @return {}
 */
var getAllFulfillments = function (data) {
    var loadSearch = nlapiLoadSearch('transaction', 'customsearch_bnc_471');
    var searchResults = loadSearch.runSearch();
    var resultIndex = 0;
    var response = [];
    do {
        var chunk = searchResults.getResults(resultIndex, resultIndex + 1000);
        for (var i in chunk) {
            if (chunk[i].getText('createdfrom') != null && chunk[i].getText('createdfrom') != '') {
                response.push({
                    "productid": (((chunk[i].getText('item')).indexOf(':') != -1) ? (chunk[i].getText('item')).substring((chunk[i].getText('item')).indexOf(':') + 1) : chunk[i].getText('item')).trim(),
                    "orderid": (chunk[i].getText('createdfrom')).replace('Sales Order #', ''),
                    "sequencenum": chunk[i].getValue('custcol_line_item_sequence'),
                    "tracking": chunk[i].getValue('trackingnumbers')
                });
            }
            resultIndex++;
        }
    } while (chunk.length >= 1000);

    return response;
};

/* ### GET TRACKING FOR WEBSITE ORDER */
/**
 * Get Tracking
 * @params data
 * @return {}
 */
var getOfbizTracking = function (data) {
    var response = {};
    var search = nlapiSearchRecord('salesorder', null, [new nlobjSearchFilter('tranid', null, 'is', data.orderId)]);
    if (search != null) {
        var orderRecord = getRecord('salesorder', search[0].id);
        if (typeof orderRecord != 'undefined') {
            if (orderRecord.getFieldValue("linkedtrackingnumbers") != null) {
                response['trackingNumber'] = orderRecord.getFieldValue("linkedtrackingnumbers");
            }
            if (orderRecord.getFieldValue("status") != null && orderRecord.getFieldValue("status") == "Billed") {
                response['status'] = "Billed";
            }
        } else {
            response['error'] = "No order found.";
        }
    }
    return response;
};



/* ### GET TRACKING NUMBERS ### */
/**
 * Get Tracking
 * @params data({company})
 * @return [{orderid, tracking, date, method, carrier, status}]
 */
var getTracking = function (data) {
    var map = {
        'amazon': 'customsearch_bnc_203',
        'quill': 'customsearch_bnc_364',
        'staples': 'customsearch_bnc_371',
        'jet': 'customsearch_bnc_914'
    };

    var loadSearch = nlapiLoadSearch('transaction', map[data.company]);
    var searchResults = loadSearch.runSearch();
    var resultIndex = 0;
    var response = [];
    do {
        var chunk = searchResults.getResults(resultIndex, resultIndex + 1000);
        for (var i in chunk) {
            response.push({
                "orderid": chunk[i].getValue('custbody_amazon_order_id'),
                "tracking": chunk[i].getValue('trackingnumbers'),
                "carrier": chunk[i].getValue('shipcarrier'),
                "method": chunk[i].getText('shipmethod'),
                "date": chunk[i].getValue('actualshipdate'),
                "status": chunk[i].getValue('status')
            });
            resultIndex++;
        }
    } while (chunk.length >= 1000);
    return response;
};

/* ### GET INVOICE NUMBERS ### */
/**
 * Get Invoice
 * @params data({company})
 * @return [{orderid, invoicenumber}]
 */
var getInvoices = function (data) {
    var map = {
        'amazon': 'customsearch_bnc_177',
        'quill': 'TODO',
        'staples': 'customsearch_staples_invoice'
    };

    var loadSearch = nlapiLoadSearch('transaction', 'customsearch_staples_invoice');
    var searchResults = loadSearch.runSearch();
    var resultIndex = 0;
    var response = [];
    do {
        var chunk = searchResults.getResults(resultIndex, resultIndex + 1000);
        for (var i in chunk) {
            response.push({
                "orderid": chunk[i].getValue('custbody_amazon_order_id'),
                "invoicenumber": chunk[i].getValue('transactionnumber')
            });
            resultIndex++;
        }
    } while (chunk.length >= 1000);
    return response;
};

/* ### CREATE RETURN ### */
/**
 * CREATE RETURN
 * @params data({orderId, items[{sku, qty, reason}, ...]})
 * @return {}
 */
var getReturn = function (data) {
    var order = null;
    if (typeof data.orderId != 'undefined') {
        order = nlapiSearchRecord('salesorder', null, new nlobjSearchFilter('tranid', null, 'is', data.orderId));
        if (order == null) {
            return { 'error': { 'message': 'Order#: ' + data.orderId + ' does not exist!' } };
        }
    } else {
        return { 'error': { 'message': 'Missing required field "orderId".' } };
    }

    order = getRecord('salesorder', order[0].getId());
    var orderId = order.getId();
    var rAuth = nlapiTransformRecord('salesorder', orderId, 'returnauthorization');
    rAuth.setFieldValue('custbody_ext_ra', data.returnId);

    //clear items
    while (rAuth.getLineItemCount('item') > 0) {
        rAuth.removeLineItem('item', 1);
    }

    //add items we want
    if (typeof data.items !== 'undefined') {
        for (var i = 0; i < data.items.length; i++) {
            rAuth.insertLineItem('item', i + 1);
            rAuth.setLineItemValue('item', 'item', i + 1, findItem({ 'sku': data.items[i].id }).id);
            rAuth.setLineItemValue('item', 'quantity', i + 1, data.items[i].qty);
            rAuth.setLineItemValue('item', 'amount', i + 1, data.items[i].amt);
            if (typeof data.items[i].name != 'undefined') {
                rAuth.setLineItemValue('item', 'description', i + 1, data.items[i].name);
            }
            if (typeof data.items[i].artworkSource != 'undefined') {
                rAuth.setLineItemValue('item', 'custcolart_option', i + 1, data.items[i].artworkSource);
            }
            if (typeof data.items[i].rate != 'undefined') {
                rAuth.setLineItemValue('item', 'rate', i + 1, data.items[i].rate);
            }
            // if(typeof data.items[i].isCustomQuantity != 'undefined') {
            //     rAuth.setLineItemValue('item', 'isCustomQuantity', i+1, data.items[i].isCustomQuantity);
            // }
        }
    }

    var rAuthId = nlapiSubmitRecord(rAuth);
    return { "authorizationId": rAuthId };
};

/* ### HELPERS ### */

/**
 * Bool To String
 * @params {bool}
 * @return {string}
 */
var bToS = function (val) {
    return (val) ? 'T' : 'F';
};


var createToken = function (data, customerId) {
    const TOKEN_RCD = 'customrecord_upybt_multi_token';
    var tokenInfo = { 'tokenRcdId': 0 };
    var tokenRcd = null;
    nlapiLogExecution("debug", "data.payment ?? ", JSON.stringify(data.payment));
    if (data.payment != null) {
        if (typeof data.payment.creditCardToken != 'undefined' && data.payment.creditCardToken != null) {
            var tokenSearchResult = nlapiSearchRecord(TOKEN_RCD, null, new nlobjSearchFilter('custrecord_upybt_token', null, 'is', data.payment.creditCardToken));
            if (tokenSearchResult != null) {
                nlapiLogExecution("debug", "create token 1307");
                tokenRcd = getRecord(TOKEN_RCD, tokenSearchResult[0].getId());
            }
            else {
                nlapiLogExecution("debug", "create token 1311");
                tokenRcd = nlapiCreateRecord(TOKEN_RCD);
                tokenRcd.setFieldValue('custrecord_upybt_customer', customerId);                
            }

            
            tokenRcd.setFieldValue('custrecord_upybt_pmt', paymentMethodId(data.payment.paymentmethod));
            tokenRcd.setFieldValue('custrecord_cc_number', data.payment.ccnumber);
            tokenRcd.setFieldValue('custrecord_cc_expiration_date', data.payment.ccexpiredate);

            tokenRcd.setFieldValue('custrecord_upybt_braintree_id', data.payment.transactionId);
            tokenRcd.setFieldValue('custrecord_upybt_token', data.payment.creditCardToken);

            //TODO: actually check if this is the only one. 
            tokenRcd.setFieldValue('custrecord_upybt_default', 'F');
            tokenRcd.setFieldValue('custrecord_memo', '');
            //tokenRcd.setFieldValue('name','');   - set in UE script to payment method and token for simplicity  

            tokenInfo.tokenRcdId = nlapiSubmitRecord(tokenRcd);
            nlapiLogExecution("debug", "tokeinInfo.tokenRcdId", tokenInfo.tokenRcdId);
        }

    }
    return tokenInfo;
}

/**
 * Create Deposit
 */
var createDeposit = function (data) {
    var order = null;
    var orderId = null;
    var deposit = null;
    var depositId = null;

    /*
     * Look up and find the record in Netsuite
     */
    if (typeof data.tranid != 'undefined') {
        order = getOrderRecord(data.tranid);
        if (!order) { nlapiLogExecution('EMERGENCY', 'No SO Found 1392  ', data.tranid); return null; }
    }

    // var depositData = { /*customform: '67',*/ recordmode: 'dynamic', salesorder: order.getId() /*, customer: order.getFieldValue('entity') */ };       
    // var depositData = { salesorder: order.getId()};       

    // var depositData = { customer: order.getFieldValue('entity') ,salesorder: order.getId()};     
    // nlapiLogExecution("debug","depo data 1308",JSON.stringify(depositData));          
    // deposit = nlapiCreateRecord('customerdeposit',depositData);

    deposit = nlapiCreateRecord('customerdeposit');
    
    if(useJamSub(data.tranDate)){
        deposit.setFieldValue('subsidiary', HENJ_SUB); // set sub to HENJ
    } else {
        deposit.setFieldValue('subsidiary', BNC_SUB); // set sub to BNC                 
    }               

    if (typeof data.customer.webSiteId != 'undefined' && data.customer.webSiteId != null && data.customer.webSiteId != '') {
        if (data.customer.webSiteId == 'envelopes' || data.customer.webSiteId == 'ae') {
            deposit.setFieldValue('class', CHANNEL_ENVELOPES);
        } else if (data.customer.webSiteId == 'folders') {
            deposit.setFieldValue('class', CHANNEL_FOLDERS);
        }
    }

    deposit.setFieldValue('customer', order.getFieldValue('entity'));
    deposit.setFieldValue('salesorder', order.getId());

    deposit.setFieldValue('collectedamount', data.total);
    deposit.setFieldValue('salesordertotal', data.total);
    deposit.setFieldValue('currency', '1');
    deposit.setFieldValue('exchangerate', '1');
    //    deposit.setFieldValue('department', data.department);
    deposit.setFieldValue('undepfunds', 'T');
    deposit.setFieldValue('currencysymbol', 'USD');

    if (data.payment != null) {
        // deposit.setFieldValue('creditcardprocessor', data.creditcardprocessor);
        //  may not be necessary for Braintree         
        deposit.setFieldValue('paymentmethod', paymentMethodId(data.payment.paymentmethod));
        // deposit.setFieldValue('ccnumber', data.payment.ccnumber);
        // deposit.setFieldValue('ccexpiredate', data.payment.ccexpiredate);        
        // deposit.setFieldValue('ccname', data.payment.ccname);                
        // deposit.setFieldValue('ccstreet', data.payment.ccstreet);
        // deposit.setFieldValue('cczipcode', data.payment.cczipcode);
        // deposit.setFieldValue('ccsecuritycode', data.payment.ccsecuritycode);

        deposit.setFieldValue('pnrefnum', data.payment.referenceNumber);

        deposit.setFieldValue('custbody_braintree_id', data.payment.transactionId);                 // mandatory
        deposit.setFieldValue('custbody_braintree_charged', bToS(!data.payment.chargeit));            // check this for Sales 
        deposit.setFieldValue('custbody_payment_method_token', data.payment.creditCardToken);

        deposit.setFieldValue('authcode', data.payment.authCode);
        deposit.setFieldValue('ccapproved', bToS(data.payment.ccapproved));         // depends on payment methid for cc shold be approved 
        deposit.setFieldValue('chargeit', bToS(data.payment.chargeit));             // should not be true for sales 

    }

    depositId = nlapiSubmitRecord(deposit);

    return { 'salesorder': data.tranid, 'depositId': depositId };
};

/**
 * Create PO
 */
var createPO = function (data) {
    try {
        var order = null;
        var orderId = null;
        var purchaseOrder = null;
        var purchaseOrderId = null;
        var stockSupplied = false;
        var poCheck = getOrderItemPO(data);
        nlapiLogExecution('debug','poCheck',JSON.stringify(poCheck));

        if (poCheck)
            if (poCheck.purchaseorder != null) {
                return poCheck;
            }
            
        //Look up and find the record in Netsuite based on Env order ID
        if (typeof data.orderId != 'undefined') {
            order = getOrderRecord(data.orderId);
            if (!order) {                 
                var error = nlapiCreateError('NO_SO_ERROR', "The SO (~1) could not be found. No PO was created.".replace("~1",data.orderId));
                throw(error);
            }
        }

        //Create the PO data object
        //if(data.vendorId == '8959777') { data.vendorId = '4075'};
        var vendorId = getVendorId(data.vendorId);
        if (!vendorId) { nlapiLogExecution('EMERGENCY', 'No Vendor Found 1492 ', data.vendorId); return null; }

        var poData = { /*customform: '118',*/ soid: order.getFieldValue('id'), shipgroup: '1', dropship: 'T', custid: order.getFieldValue('entity'), entity: vendorId };
        if (typeof data.poType !== 'undefined' && data.poType != null && data.poType == 'SPECIAL_ORDER') {
            delete poData.dropship;
            delete poData.shipgroup;
            poData.specord = 'T';
        }

        //if stock isnt supplied then its a drop ship for a service item only, not the product and cannot be associated to the SO
        if (typeof data.stockSupplied !== 'undefined' && data.stockSupplied != null && data.stockSupplied) {
            delete poData.soid;
            stockSupplied = true;
        }

        //Look up and find the record in Netsuite based on Env order ID to get PO vendor
        var lines = order.getLineItemCount('item');
        for (var j = 1; j <= order.getLineItemCount('item'); j++) {
            if (typeof data.lineItem != 'undefined' && order.getLineItemValue('item', 'custcol_line_item_sequence', j) == data.lineItem) {
                if (order.getLineItemValue('item', 'povendor', j) != null) {
                    poData['poentity'] = order.getLineItemValue('item', 'povendor', j);
                }
            }
        }
        poData['subsidiary'] = order.getFieldValue('subsidiary'); 
        //console.log(poData);
        purchaseOrder = nlapiCreateRecord('purchaseorder', poData);

        //if its a print service PO, add the line item
        if (stockSupplied) {
            purchaseOrder.insertLineItem('item', 1);
            purchaseOrder.setLineItemValue('item', 'item', 1, findItem({ 'sku': data.stockSuppliedSku }).id);
            purchaseOrder.setLineItemValue('item', 'customer', 1, order.getFieldValue('entity'));
            purchaseOrder.setLineItemValue('item', 'description', 1, data.name);
            purchaseOrder.setLineItemValue('item', 'amount', 1, data.cost);
            purchaseOrder.setLineItemValue('item', 'quantity', 1, data.quantity.replace(',', ''));
            purchaseOrder.setLineItemValue('item', 'custcoldue_date', 1, data.dueDate);
            purchaseOrder.setLineItemValue('item', 'custcol_line_item_sequence', 1, data.lineItem);
            purchaseOrder.setLineItemValue('item', 'custcol_item_number', 1, null);
            purchaseOrder.setLineItemValue('item', 'custcolreference_po_id', 1, data.orderId);
        } else {
            //Loop through the PO items and remove the lines that do not match the line item we are creating a PO
            for (var j = purchaseOrder.getLineItemCount('item'); j >= 1; j--) {
                if (typeof data.lineItem != 'undefined' && purchaseOrder.getLineItemValue('item', 'custcol_line_item_sequence', j) != data.lineItem) {
                    purchaseOrder.removeLineItem('item', j);
                } else {
                    purchaseOrder.setLineItemValue('item', 'customer', j, order.getFieldValue('entity'));
                    //Added 1/24/2023 to set proper rate for COGS accrual process
                    var rate =  parseFloat(data.cost)/parseFloat(purchaseOrder.getLineItemValue('item','quantity',j));
                    nlapiLogExecution('debug','rate for line: '+j,rate);
                    purchaseOrder.setLineItemValue('item','rate',j,rate);
                    purchaseOrder.setLineItemValue('item', 'amount', j, data.cost);
                    purchaseOrder.setLineItemValue('item', 'custcoldue_date', j, data.dueDate);
                    purchaseOrder.setLineItemValue('item', 'custcol_item_number', j, null);
                }
            }
        }

        //console.log(purchaseOrder);

        //Set other misc
        purchaseOrder.setFieldValue('shipdate', data.shipDate);
        purchaseOrder.setFieldValue('shipaddressee', order.getFieldValue('shipaddressee'));
        purchaseOrder.setFieldValue('shipattention', order.getFieldValue('shipattention'));
        purchaseOrder.setFieldValue('shipaddr1', order.getFieldValue('shipaddr1'));
        purchaseOrder.setFieldValue('shipaddr2', order.getFieldValue('shipaddr2'));
        purchaseOrder.setFieldValue('shipaddr3', order.getFieldValue('shipaddr3'));
        purchaseOrder.setFieldValue('shipcity', order.getFieldValue('shipcity'));
        purchaseOrder.setFieldValue('shipstate', order.getFieldValue('shipstate'));
        purchaseOrder.setFieldValue('shipcity', order.getFieldValue('shipcity'));
        purchaseOrder.setFieldValue('shipzip', order.getFieldValue('shipzip'));
        purchaseOrder.setFieldValue('shipaddress', order.getFieldValue('shipaddress'));
        purchaseOrder.setFieldValue('currency', '1');
        purchaseOrder.setFieldValue('custbody_printed_or_plain', order.getFieldValue('custbody_printed_or_plain'));
        purchaseOrder.setFieldValue('custbody_brand', order.getFieldValue('custbody_brand'));
        purchaseOrder.setFieldValue('shipmethod', order.getFieldValue('shipmethod'));

        purchaseOrder.setLineItemValue('item', 'customer', 1, order.getFieldValue('entity'));

        if (typeof data.comments != 'undefined' && data.comments != '') {
            purchaseOrder.setFieldValue('custbody_comments', data.comments);
        }

        if (typeof data.emailPO != 'undefined' && !data.emailPO) {
            purchaseOrder.setFieldValue('tobeemailed', 'F');
        } else {
            purchaseOrder.setFieldValue('tobeemailed', 'T');
        }

        var newTranId = data.orderId+(data.lineItem.toString().length>1 ? '_000'+data.lineItem.toString() : '_0000'+data.lineItem.toString());

        // purchaseOrder.setFieldValue('tranid',newTranId);

        purchaseOrderId = nlapiSubmitRecord(purchaseOrder);
        nlapiSubmitField('purchaseorder',purchaseOrderId,'tranid',newTranId);
        purchaseOrder = getRecord('purchaseorder', purchaseOrderId);

        //if its a print service po, update the original order with the PO reference
        if (stockSupplied) {
            // var outSourceLocation = nlapiLookupField("vendor", vendorId, "custentity_mb_outsource_location");
            order.setFieldValue('custbody_stock_supplied', 'T');
            lines = order.getLineItemCount('item');
            for (var j = 1; j <= order.getLineItemCount('item'); j++) {
                if (typeof data.lineItem != 'undefined' && order.getLineItemValue('item', 'custcol_line_item_sequence', j) == data.lineItem) {
                    order.setLineItemValue('item', 'custcolreference_po_id', j, purchaseOrder.getFieldValue('tranid'));
                    // set location to vendor location (from vendor record)
                    // if(outSourceLocation) order.setLineItemValue("location",outSourceLocation); 
                    // add po reference on so line for this PO  purchaseOrderId .... 
                    order.setLineItemValue('item', 'custcol_stock_supplied', j, 'T');
                }
            }

            nlapiSubmitRecord(order);
        }

        return { 'salesorder': data.orderId, 'purchaseorder': purchaseOrder.getFieldValue('tranid'), 'purchaseOrderId': purchaseOrderId };
    } catch (err) {
        nlapiLogExecution('Error', 'Error in createPO data = ', JSON.stringify(data))
        nlapiLogExecution('EMERGENCY', 'error in createPO function', JSON.stringify(err));
        return ("Error in createPO : " + JSON.stringify(err))

    }
};

//##############################################
//##############User Events#####################
//##############################################
/**
 * Update EDI Order and Insert fees
 */
var officeDepotRates = { "EX10-LEBAGMPF": 35, "EX10-LEBAGO28": 35, "EX10-LEBAGR28": 35, "EX10-LEBALB28": 35, "EX10-LEBALY28": 35, "EX10-LEBAMG28": 35, "EX10-LEBANA28": 35, "EX10-LEBAOL23": 35, "EX10-LEBAOL24": 35, "EX10-LEBAOL28": 35, "EX10-LEBAOR28": 35, "EX10-LEBAPI28": 35, "EX10-LEBAQM28": 35, "EX10-LEBAQM6SPF": 35, "EX10-LEBAQMPC": 35, "EX10-LEBAQMPF": 35, "EX10-LEBARE28": 35, "EX10-LEBASM28": 35, "EX10-LEBASM6SPF": 35, "EX10-LEBASMPC": 35, "EX10-LEBASMPF": 35, "EX10-LEBATE23": 35, "EX10-LEBATE24": 35, "EX10-LEBATE28": 35, "EX10-LEBAWH28": 35, "EX1644-10": 35, "EX1644-11": 35, "EX1644-12": 35, "EX1644-13": 35, "EX1644-14": 35, "EX1644-15": 35, "EX1644-17": 35, "EX1644-18": 35, "EX1644-22": 35, "EX1644-23": 35, "EX1644-25": 35, "EX1644-26": 35, "EX1644-27": 35, "EX1CO-27": 35, "EX4010-10": 35, "EX4010-11": 35, "EX4010-12": 35, "EX4010-13": 35, "EX4010-14": 35, "EX4010-15": 35, "EX4010-17": 35, "EX4010-18": 35, "EX4010-22": 35, "EX4010-23": 35, "EX4010-25": 35, "EX4010-26": 35, "EX4010-27": 35, "EX4010-56": 35, "EX4020-10": 35, "EX4020-11": 35, "EX4020-12": 35, "EX4020-13": 35, "EX4020-14": 35, "EX4020-15": 35, "EX4020-17": 35, "EX4020-18": 35, "EX4020-22": 35, "EX4020-23": 35, "EX4020-25": 35, "EX4020-26": 35, "EX4020-27": 35, "EX4020-56": 35, "EX4030-10": 35, "EX4030-11": 35, "EX4030-12": 35, "EX4030-13": 35, "EX4030-14": 35, "EX4030-15": 35, "EX4030-17": 35, "EX4030-18": 35, "EX4030-22": 35, "EX4030-23": 35, "EX4030-25": 35, "EX4030-26": 35, "EX4030-27": 35, "EX4030-56": 35, "EX4040-10": 35, "EX4040-11": 35, "EX4040-12": 35, "EX4040-13": 35, "EX4040-14": 35, "EX4040-15": 35, "EX4040-16": 35, "EX4040-17": 35, "EX4040-18": 35, "EX4040-22": 35, "EX4040-23": 35, "EX4040-25": 35, "EX4040-26": 35, "EX4040-27": 35, "EX4040-56": 35, "EX4060-10": 35, "EX4060-11": 35, "EX4060-12": 35, "EX4060-13": 35, "EX4060-14": 35, "EX4060-15": 35, "EX4060-17": 35, "EX4060-18": 35, "EX4060-22": 35, "EX4060-23": 35, "EX4060-25": 35, "EX4060-26": 35, "EX4060-27": 35, "EX4080-10": 35, "EX4080-11": 35, "EX4080-12": 35, "EX4080-13": 35, "EX4080-14": 35, "EX4080-15": 35, "EX4080-17": 35, "EX4080-18": 35, "EX4080-22": 35, "EX4080-23": 35, "EX4080-25": 35, "EX4080-26": 35, "EX4080-27": 35, "EX4820-10": 35, "EX4820-11": 35, "EX4820-12": 35, "EX4820-13": 35, "EX4820-14": 35, "EX4820-15": 35, "EX4820-17": 35, "EX4820-18": 35, "EX4820-22": 35, "EX4820-23": 35, "EX4820-25": 35, "EX4820-26": 35, "EX4820-27": 35, "EX4860-10": 35, "EX4860-11": 35, "EX4860-12": 35, "EX4860-13": 35, "EX4860-14": 35, "EX4860-15": 35, "EX4860-17": 35, "EX4860-18": 35, "EX4860-22": 35, "EX4860-23": 35, "EX4860-25": 35, "EX4860-26": 35, "EX4860-27": 35, "EX4865-10": 35, "EX4865-11": 35, "EX4865-12": 35, "EX4865-13": 35, "EX4865-14": 35, "EX4865-15": 35, "EX4865-17": 35, "EX4865-18": 35, "EX4865-22": 35, "EX4865-23": 35, "EX4865-25": 35, "EX4865-26": 35, "EX4865-27": 35, "EX4870-10": 35, "EX4870-11": 35, "EX4870-12": 35, "EX4870-13": 35, "EX4870-14": 35, "EX4870-15": 35, "EX4870-17": 35, "EX4870-18": 35, "EX4870-22": 35, "EX4870-23": 35, "EX4870-25": 35, "EX4870-26": 35, "EX4870-27": 35, "EX4875-10": 35, "EX4875-11": 35, "EX4875-12": 35, "EX4875-13": 35, "EX4875-14": 35, "EX4875-15": 35, "EX4875-17": 35, "EX4875-18": 35, "EX4875-22": 35, "EX4875-23": 35, "EX4875-25": 35, "EX4875-26": 35, "EX4875-27": 35, "EX4880-10": 35, "EX4880-11": 35, "EX4880-12": 35, "EX4880-13": 35, "EX4880-14": 35, "EX4880-15": 35, "EX4880-17": 35, "EX4880-18": 35, "EX4880-22": 35, "EX4880-23": 35, "EX4880-25": 35, "EX4880-26": 35, "EX4880-27": 35, "EX4894-10": 35, "EX4894-11": 35, "EX4894-12": 35, "EX4894-13": 35, "EX4894-14": 35, "EX4894-15": 35, "EX4894-17": 35, "EX4894-18": 35, "EX4894-22": 35, "EX4894-23": 35, "EX4894-25": 35, "EX4894-26": 35, "EX4894-27": 35, "EX4895-10": 35, "EX4895-11": 35, "EX4895-12": 35, "EX4895-13": 35, "EX4895-14": 35, "EX4895-15": 35, "EX4895-17": 35, "EX4895-18": 35, "EX4895-22": 35, "EX4895-23": 35, "EX4895-25": 35, "EX4895-26": 35, "EX4895-27": 35, "EX4897-10": 35, "EX4897-11": 35, "EX4897-12": 35, "EX4897-13": 35, "EX4897-14": 35, "EX4897-15": 35, "EX4897-17": 35, "EX4897-18": 35, "EX4897-22": 35, "EX4897-23": 35, "EX4897-25": 35, "EX4897-26": 35, "EX4897-27": 35, "EX4899-10": 35, "EX4899-11": 35, "EX4899-12": 35, "EX4899-13": 35, "EX4899-14": 35, "EX4899-15": 35, "EX4899-17": 35, "EX4899-18": 35, "EX4899-22": 35, "EX4899-23": 35, "EX4899-25": 35, "EX4899-26": 35, "EX4899-27": 35, "EX5010-10": 35, "EX5010-11": 35, "EX5010-12": 35, "EX5010-13": 35, "EX5010-14": 35, "EX5010-15": 35, "EX5010-17": 35, "EX5010-18": 35, "EX5010-22": 35, "EX5010-23": 35, "EX5010-25": 35, "EX5010-26": 35, "EX5010-27": 35, "EX5020-10": 35, "EX5020-11": 35, "EX5020-12": 35, "EX5020-13": 35, "EX5020-14": 35, "EX5020-15": 35, "EX5020-17": 35, "EX5020-18": 35, "EX5020-22": 35, "EX5020-23": 35, "EX5020-25": 35, "EX5020-26": 35, "EX5020-27": 35, "EX5030-10": 35, "EX5030-11": 35, "EX5030-12": 35, "EX5030-13": 35, "EX5030-14": 35, "EX5030-15": 35, "EX5030-17": 35, "EX5030-18": 35, "EX5030-22": 35, "EX5030-23": 35, "EX5030-25": 35, "EX5030-26": 35, "EX5030-27": 35, "EX5040-10": 35, "EX5040-11": 35, "EX5040-12": 35, "EX5040-13": 35, "EX5040-14": 35, "EX5040-15": 35, "EX5040-17": 35, "EX5040-18": 35, "EX5040-22": 35, "EX5040-23": 35, "EX5040-25": 35, "EX5040-26": 35, "EX5040-27": 35, "EX5060-10": 35, "EX5060-11": 35, "EX5060-12": 35, "EX5060-13": 35, "EX5060-14": 35, "EX5060-15": 35, "EX5060-17": 35, "EX5060-18": 35, "EX5060-22": 35, "EX5060-23": 35, "EX5060-25": 35, "EX5060-26": 35, "EX5060-27": 35, "EX7716-10": 35, "EX7716-11": 35, "EX7716-12": 35, "EX7716-13": 35, "EX7716-14": 35, "EX7716-15": 35, "EX7716-17": 35, "EX7716-18": 35, "EX7716-22": 35, "EX7716-23": 35, "EX7716-26": 35, "EX7716-27": 35, "EX8515-10": 35, "EX8515-11": 35, "EX8515-12": 35, "EX8515-13": 35, "EX8515-14": 35, "EX8515-15": 35, "EX8515-17": 35, "EX8515-18": 35, "EX8515-22": 35, "EX8515-23": 35, "EX8515-25": 35, "EX8515-26": 35, "EX8515-27": 35, "EX8535-10": 35, "EX8535-11": 35, "EX8535-12": 35, "EX8535-13": 35, "EX8535-14": 35, "EX8535-15": 35, "EX8535-17": 35, "EX8535-18": 35, "EX8535-22": 35, "EX8535-23": 35, "EX8535-25": 35, "EX8535-26": 35, "EX8535-27": 35, "EX8555-10": 35, "EX8555-11": 35, "EX8555-12": 35, "EX8555-13": 35, "EX8555-14": 35, "EX8555-15": 35, "EX8555-17": 35, "EX8555-18": 35, "EX8555-22": 35, "EX8555-23": 35, "EX8555-25": 35, "EX8555-26": 35, "EX8555-27": 35, "EXLEVC-10": 35, "EXLEVC-11": 35, "EXLEVC-12": 35, "EXLEVC-13": 35, "EXLEVC-14": 35, "EXLEVC-15": 35, "EXLEVC-17": 35, "EXLEVC-18": 35, "EXLEVC-22": 35, "EXLEVC-23": 35, "EXLEVC-25": 35, "EXLEVC-26": 35, "EXLEVC-27": 35, "EXP-0220PL": 35, "EXP-1602PL": 35, "F-4220-B": 35, "F-4550-B": 35, "F-4560-B": 35, "F-4561-B": 35, "F-4565-B": 35, "F-4570-B": 35, "F-4575-B": 35, "F-4580-B": 35, "F-4585-B": 35, "F-4590-B": 35, "F-4595-B": 35, "F-6075-B": 35, "F-8505-B": 35, "F-8515-B": 35, "F-8525-B": 35, "F-8535-B": 35, "F-8545-B": 35, "F-8555-B": 35, "F-8565-B": 35, "F-8575-B": 35, "F-8585-B": 35, "F-8595-B": 35, "FA4010-01": 35, "FA4010-02": 35, "FA4010-03": 35, "FA4010-04": 35, "FA4010-05": 35, "FA4010-06": 35, "FA4010-07": 35, "FA4020-01": 35, "FA4020-02": 35, "FA4020-03": 35, "FA4020-04": 35, "FA4020-05": 35, "FA4020-06": 35, "FA4020-07": 35, "FA4030-01": 35, "FA4030-02": 35, "FA4030-03": 35, "FA4030-04": 35, "FA4030-05": 35, "FA4030-06": 35, "FA4030-07": 35, "FA4040-01": 35, "FA4040-02": 35, "FA4040-03": 35, "FA4040-04": 35, "FA4040-05": 35, "FA4040-06": 35, "FA4040-07": 35, "FA4060-01": 35, "FA4060-02": 35, "FA4060-03": 35, "FA4060-04": 35, "FA4060-05": 35, "FA4060-06": 35, "FA4060-07": 35, "FA4865-01": 35, "FA4865-02": 35, "FA4865-03": 35, "FA4865-04": 35, "FA4865-05": 35, "FA4865-06": 35, "FA4865-07": 35, "FA4870-01": 35, "FA4870-02": 35, "FA4870-03": 35, "FA4870-04": 35, "FA4870-05": 35, "FA4870-06": 35, "FA4870-07": 35, "FA4875-01": 35, "FA4875-02": 35, "FA4875-03": 35, "FA4875-04": 35, "FA4875-05": 35, "FA4875-06": 35, "FA4875-07": 35, "FA4880-01": 35, "FA4880-02": 35, "FA4880-03": 35, "FA4880-04": 35, "FA4880-05": 35, "FA4880-06": 35, "FA4880-07": 35, "FA4895-01": 35, "FA4895-02": 35, "FA4895-03": 35, "FA4895-04": 35, "FA4895-05": 35, "FA4895-06": 35, "FA4895-07": 35, "FA5010-01": 35, "FA5010-02": 35, "FA5010-03": 35, "FA5010-04": 35, "FA5010-05": 35, "FA5010-06": 35, "FA5010-07": 35, "FA5020-01": 35, "FA5020-02": 35, "FA5020-03": 35, "FA5020-04": 35, "FA5020-05": 35, "FA5020-06": 35, "FA5020-07": 35, "FA5030-01": 35, "FA5030-02": 35, "FA5030-03": 35, "FA5030-04": 35, "FA5030-05": 35, "FA5030-06": 35, "FA5030-07": 35, "FA5040-01": 35, "FA5040-02": 35, "FA5040-03": 35, "FA5040-04": 35, "FA5040-05": 35, "FA5040-06": 35, "FA5040-07": 35, "FA5060-01": 35, "FA5060-02": 35, "FA5060-03": 35, "FA5060-04": 35, "FA5060-05": 35, "FA5060-06": 35, "FA5060-07": 35, "FA81211-02": 35, "FA81211-03": 35, "FA81211-04": 35, "FA81211-05": 35, "FA81211-06": 35, "FA81211-07": 35, "FA81211-C-01": 35, "FA81211-C-02": 35, "FA81211-C-03": 35, "FA81211-C-04": 35, "FA81211-C-05": 35, "FA81211-C-06": 35, "FA81211-C-07": 35, "FB4880-GR": 35, "FB4880-SD": 35, "FB4880-SF": 35, "FE-4220-12": 35, "FE-4220-15": 35, "FE-6070-15": 35, "FE-7280-12": 35, "FE-7280-13": 35, "FE-7280-15": 35, "FE-7300-15": 35, "FE4265-12": 35, "FE4265-15": 35, "FE4265-20": 35, "FE4270-12": 35, "FE4270-15": 35, "FE4270-20": 35, "FE4270-22": 35, "FE4275-12": 35, "FE4275-15": 35, "FE4275-20": 35, "FE4275-22": 35, "FE4280-12": 35, "FE4280-15": 35, "FE4280-20": 35, "FE4280-22": 35, "FE4565-05": 35, "FE4570-05": 35, "FE4575-05": 35, "FE4580-05": 35, "FE4585-05": 35, "FE4590-05": 35, "FE4595-05": 35, "FE4865-22": 35, "FE614GF-12": 35, "FE614GF-22": 35, "FE614ZF-12": 35, "FE614ZF-22": 35, "FE8535-20": 35, "FEA7GF-12": 35, "FEA7GF-22": 35, "FEA7ZF-12": 35, "FEXA7ZF-22": 35, "FFW-10": 35, "FFW-10-103": 35, "FFW-10-18": 35, "FFW-10-B": 35, "FFW-10-GB": 35, "FFW-10-L20": 35, "FFW-10-L22": 35, "FFW-1013": 35, "FFW-125": 35, "FFW-69": 35, "FFW-69-103": 35, "FFW-69-18": 35, "FFW-69-B": 35, "FFW-69-GB": 35, "FFW-69-L20": 35, "FFW-69-L22": 35, "FFW-83411": 35, "FFW-912": 35, "FLBK4872-01": 35, "FLBK4872-03": 35, "FLBK4872-04": 35, "FLBK4880-01": 35, "FLBK4880-03": 35, "FLBK4880-04": 35, "FLNT4260-04": 35, "FLNT4870-04": 35, "FLNT4872-01": 35, "FLNT4872-02": 35, "FLNT4872-04": 35, "FLNT4875-04": 35, "FLNT4880-01": 35, "FLNT4880-02": 35, "FLNT4880-04": 35, "FLNT4885-04": 35, "FLNV4872-03": 35, "FLNV4872-04": 35, "FLNV4880-03": 35, "FLNV4880-04": 35, "FLSL4872-02": 35, "FLSL4880-02": 35, "WEL-DDBLU100-GF": 35, "WEL-DE100-GF": 35, "WEL-DDP100-GF": 35, "LF-118-SG12": 35, "LF-118-DDBLK100": 35, "WEL-DB100-GF": 35, "LF-118-DDBLU100": 35 };
var staplesRates = { "LUX-PF-10": 18, "LUX-PF-26": 18, "LUX-PF-11": 18, "LUX-PF-18": 18, "PF-M07": 18, "PF-M06": 18, "LUX-PF-101": 18, "LUX-PF-113": 18, "LUX-PF-103": 18, "LUX-PF-25": 18, "LUX-PF-23": 18, "PF-BLI": 18, "LUX-PF-22": 18, "LUX-PF-17": 18, "PF-DBLI": 18, "LUX-PF-14": 18, "PF-NLI": 18, "WEL-DDBLU100-GF": 18, "SF-102-DDBLU100": 18, "WEL-DE100-GF": 18, "MF-144-DDBLU100": 18, "CHEL-185-DDBLK100-F": 18, "MF-4801-DDBLU100": 18, "CHEL-185-DDBLU100-F": 18, "LF-118-SG12": 18, "CHEL-185-DDBLU100": 18, "DTF-3PRONG": 18, "WEL-BN100-GF": 18, "CHEL-185-DB100": 18, "MF-144-DDBLK100": 18, "LF-118-DB100": 18, "CHEL-185-SG12": 18, "WEL-DB100-GF": 18, "WEL-DDBLU100-SF": 18, "CHEL-185-BN100": 18, "LF-118-DDP100": 18, "MF-4801-SG12": 18, "CHEL-185-DDP100": 18, "WEL-SG12-GF": 18, "LF-118-DDBLU100": 18, "WEL-DDBLK100-SF": 18, "SF-101-DDP100": 18, "OR-144-SG12": 18, "SF-101-DB12": 18, "SF-101-CSG100": 18, "SF-101-DB100": 18, "SF-101-CMBLU12": 18, "OR-145-CSG100": 18, "SF-101-AW100": 18, "OR-145-DDBLU100": 18, "TAX-912-NF80": 18, "SF-101-DN12": 18, "OR-145-DDBLK100": 18, "SF-101-SGLOSS": 18, "SF-101-RGLOSS": 18, "TAX-912-CEI80": 18, "SF-101-SG12": 18, "PF-100WLI": 18, "SF-101-DE100": 18, "MF-144-DDP100": 18, "OR-144-DDBLK100": 18, "OR-144-DDBLU100": 18, "CHEL-185-DDBLK100": 18, "2SAFPL": 18, "PDCL-85X11-DB": 18, "SF-101-546-TAX": 18, "ACCO-SAPF": 18, "PDCL-85X11-NB": 18, "CH91212-M07": 18, "CH91212-M06": 18, "CH91212-22": 18, "LUX-4895-102": 28, "LUX-4895-113": 28, "LUX-8505-103": 28, "LUX-4895-103": 28, "LUX-8505-102": 28, "LUX-8505-104": 28, "LUX-4895-112": 28, "LUX-8505-106": 28, "LUX-8515-112": 28, "LUX-8515-113": 28, "LUX-8535-112": 28, "LUX-8535-113": 28, "LUX-8545-101": 28, "LUX-8545-102": 28, "LUX-8545-103": 28, "PRT4880-BDOT": 28, "LUX-8545-104": 28, "LUX-8545-106": 28, "PRT4880-FLGD": 28, "PRT4880-BGIN": 28, "PRT4880-FRST": 28, "LUX-7716-101": 28, "PRT4880-AMER": 28, "PRT4880-BLNS": 28, "PRT4880-GGIN": 28, "PRT4880-PDOT": 28, "PRT4880-YGIN": 28, "PRT4880-SEST": 28, "LUX-7716-103": 28, "PRT4880-RLNS": 28, "LUX-7716-102": 28, "PRT4880-PGIN": 28, "LUX-7716-104": 28, "LUX-7716-106": 28, "LUX-7716-112": 28, "LUX-8505-101": 28, "LUX-7716-113": 28, "CF4880-BCHV": 28, "FLWH8535-01": 28, "FLWH8535-03": 28, "FLWH8535-02": 28, "FLWH8535-04": 28, "FLWHPHGC-03": 28, "FLWHPHGC-01": 28, "FLWHPHGC-04": 28, "LUX-4860-101": 28, "LUX-4860-07": 28, "FLWHPHGC-02": 28, "LUX-4860-102": 28, "LUX-4860-104": 28, "LUX-4860-106": 28, "LUX-4860-103": 28, "LUX-4860-112": 28, "LUX-4860-113": 28, "FLNV4872-03": 28, "FLSM4872-03": 28, "FLNT4885-04": 28, "FLWH4872-03": 28, "FLBK4872-03": 28, "FLWH4885-04": 28, "FLWH4885-01": 28, "LUX-4872-26": 28, "LUX-4872-23": 28, "FLWH4885-02": 28, "LUX-4875-101": 28, "FLWH4885-03": 28, "LUX-4875-104": 28, "LUX-4872-25": 28, "LUX-4875-105": 28, "LUX-4875-102": 28, "LUX-4875-112": 28, "LUX-4875-103": 28, "LUX-4875-106": 28, "LUX-4875-113": 28, "LUX-4880-104": 28, "LUX-4880-102": 28, "LUX-4880-103": 28, "LUX-4880-101": 28, "LUX-4880-106": 28, "LUX-4880-112": 28, "LUX-4880-113": 28, "LUX-4865-101": 28, "LUX-4895-101": 28, "LUX-4865-102": 28, "LUX-4865-106": 28, "LUX-4865-104": 28, "LUX-4865-103": 28, "LUX-4865-113": 28, "LUX-4865-105": 28, "LUX-4865-112": 28, "LUX-4870-104": 28, "LUX-4870-106": 28, "LUX-4870-101": 28, "LUX-4870-112": 28, "LUX-4870-103": 28, "LUX-4870-102": 28, "LUX-4870-105": 28, "LUX-4870-113": 28, "LUX-4872-102": 28, "LUX-4872-10": 28, "LUX-4872-101": 28, "LUX-4872-104": 28, "LUX-4872-105": 28, "LUX-4872-103": 28, "LUX-4872-106": 28, "LUX-4872-11": 28, "LUX-4872-112": 28, "LUX-4872-113": 28, "LUX-4872-12": 28, "LUX-4872-14": 28, "LUX-4872-13": 28, "LUX-4895-104": 28, "LUX-4872-17": 28, "LUX-4872-22": 28, "LUX-4872-18": 28, "LUX-4895-106": 28, "EX8515-18": 28, "EX4880-22": 28, "EX4895-18": 28, "EX4880-23": 28, "EX4880-25": 28, "EX4880-27": 28, "EX4880-18": 28, "EX4880-15": 28, "EX4880-26": 28, "EX4880-12": 28, "EX4880-17": 28, "EX4880-14": 28, "EX4880-11": 28, "EX4880-13": 28, "EX4880-10": 28, "EX4875-22": 28, "EX4875-14": 28, "EX4875-11": 28, "EX4870-18": 28, "EX4875-10": 28, "EX4870-22": 28, "EX4870-23": 28, "EX4870-27": 28, "EX4870-19": 28, "EX4870-17": 28, "EX4870-16": 28, "EX4870-14": 28, "EX4870-15": 28, "EX4870-12": 28, "EX4870-10": 28, "EX4870-13": 28, "EX4865-27": 28, "EX4870-11": 28, "EX4865-23": 28, "EX4865-25": 28, "EX4865-22": 28, "EX4865-18": 28, "EX4865-17": 28, "EX4865-24": 28, "EX4865-19": 28, "EX4865-16": 28, "EX4865-10": 28, "EX4865-15": 28, "EX4865-13": 28, "EX4865-12": 28, "EX4865-11": 28, "EX4865-14": 28, "ET4880-16": 28, "ET4880-14": 28, "ET4880-12": 28, "ET4880-06": 28, "ET4880-08": 28, "CS1880-16": 28, "CS1880-27": 28, "CS1880-14": 28, "CS1880-06": 28, "CS1880-11": 28, "CS1880-07": 28, "CS1865-18": 28, "CS1865-B": 28, "CS1880-102": 28, "CS1865-22": 28, "CS1865-102": 28, "CS1865-27": 28, "CS1865-16": 28, "CS1865-11": 28, "CS1865-07": 28, "CF4880-99": 28, "CS1865-14": 28, "CS1865-06": 28, "CF4880-B": 28, "CF4880-22": 28, "CF4880-16": 28, "CF4880-98": 28, "CF4880-97": 28, "CF4880-18": 28, "CF4880-14": 28, "CF4880-11": 28, "CF4880-96": 28, "CF4880-103": 28, "CF4880-102": 28, "CF4880-06": 28, "CCA7": 28, "CF4880-01": 28, "CF4880-07": 28, "CCA9": 28, "CC66": 28, "CCA6": 28, "CC10": 28, "94623": 28, "8585-GB": 28, "CCA2": 28, "8585-50": 28, "8565-GB": 28, "8565-03": 28, "8545-GB": 28, "8545-50": 28, "8545-03": 28, "8535-WPC": 28, "8535-SW": 28, "8535-50": 28, "8535-GB": 28, "8535-SN": 28, "8535-29": 28, "8535-08": 28, "8535-06": 28, "8525-90": 28, "8515-WPC": 28, "8515-WLI": 28, "8515-SN": 28, "8515-SW": 28, "8515-NPC": 28, "8515-NLI": 28, "8515-GB": 28, "8515-50": 28, "8505-WPC": 28, "8515-03": 28, "8505-WLI": 28, "8505-SN": 28, "8505-SW": 28, "8505-NPC": 28, "8505-NLI": 28, "5870-GL": 28, "5870-01": 28, "5395-07": 28, "5865-01": 28, "5395-02": 28, "5380-30": 28, "5380-29": 28, "8505-GB": 28, "8505-BLI": 28, "8505-50": 28, "8505-20": 28, "5380-28": 28, "8505-18": 28, "8505-03": 28, "8504-AO": 28, "7716-WPC": 28, "7716-WLI": 28, "7716-SW": 28, "7716-SN": 28, "7716-NPC": 28, "7716-NLI": 28, "72957": 28, "72965": 28, "72940": 28, "6680-16": 28, "6680-15": 28, "6680-13": 28, "6680-14": 28, "6680-12": 28, "6680-11": 28, "6675-14": 28, "6675-11": 28, "6670-16": 28, "6670-15": 28, "6670-13": 28, "6670-14": 28, "6670-11": 28, "6670-12": 28, "6665-11": 28, "5890-01": 28, "5885-01": 28, "5880-GL": 28, "5880-01": 28, "55PS-W": 28, "5395-08": 28, "5395-06": 28, "4865-WPP": 28, "4865-SN": 28, "4865-WPC": 28, "4865-W": 28, "4865-NPC": 28, "4865-SW": 28, "4865-GB": 28, "4865-BLI": 28, "4865-00": 28, "4865-NLI": 28, "20743": 28, "20677": 28, "5380-27": 28, "5380-26": 28, "5380-24": 28, "5380-25": 28, "5380-20": 28, "5380-18": 28, "5380-17": 28, "5380-15": 28, "5380-12": 28, "5380-14": 28, "5380-11": 28, "5380-08": 28, "5380-07": 28, "5380-04": 28, "5380-06": 28, "5380-02": 28, "4860-WPC": 28, "7535": 28, "4860-WLI": 28, "4860-SW": 28, "4860-NLI": 28, "4860-SN": 28, "4860-NPC": 28, "4860-70W": 28, "4860-80W": 28, "4860-00": 28, "SH4280-08": 28, "SH4280-06": 28, "SH4280-07": 28, "SH4280-05": 28, "SH4280-03": 28, "SH4280-02": 28, "SH4280-04": 28, "SH4265-07": 28, "SH4265-05": 28, "MR4880-02": 28, "MR4880-01": 28, "SH4270-08": 28, "SH4280-01": 28, "SH4270-07": 28, "SH4270-06": 28, "SH4270-03": 28, "SH4270-04": 28, "SH4270-02": 28, "SH4270-05": 28, "SH4270-01": 28, "FLWH4895-04": 28, "5375-28": 28, "5375-07": 28, "5375-06": 28, "5370-28": 28, "5370-29": 28, "5370-27": 28, "5370-25": 28, "5370-24": 28, "5370-26": 28, "5370-18": 28, "5370-17": 28, "5370-15": 28, "5370-20": 28, "5370-14": 28, "5370-12": 28, "5370-06": 28, "5370-07": 28, "5370-04": 28, "5370-02": 28, "5370-11": 28, "5370-08": 28, "5365-29": 28, "5365-28": 28, "5365-24": 28, "5365-20": 28, "5365-26": 28, "5365-18": 28, "5365-25": 28, "5365-27": 28, "5365-17": 28, "5365-12": 28, "5365-15": 28, "5365-08": 28, "5365-14": 28, "5365-11": 28, "5365-06": 28, "5365-02": 28, "4895-WPC": 28, "5365-04": 28, "4895-WLI": 28, "5365-07": 28, "4895-SN": 28, "4895-SW": 28, "4895-NLI": 28, "4895-BLI": 28, "4890-00": 28, "4895-GB": 28, "4885-WPP": 28, "4890-WPP": 28, "4885-00": 28, "4880V-WPC": 28, "4880V-WLI": 28, "4880V-W": 28, "4880V-SW": 28, "4880V-SN": 28, "4880V-NPC": 28, "4880V-NLI": 28, "4880V-GB": 28, "4880V-BLI": 28, "4880V-B": 28, "4880V-18": 28, "4880V-01": 28, "4880V-103": 28, "4880-WPC": 28, "4880-WPP": 28, "4880-WLI": 28, "4880-SW": 28, "4880-NPC": 28, "4880-SN": 28, "4880-NLI": 28, "4880-GB": 28, "4880-BLI": 28, "4880-00": 28, "4875-GB": 28, "4875-WPP": 28, "4875-WPC": 28, "4875-BLI": 28, "4872-WPP": 28, "4872-WPC": 28, "4875-00": 28, "4872-WLI": 28, "4872-W": 28, "4872-SW": 28, "4872-SN": 28, "4872-R": 28, "4872-NPC": 28, "4872-NLI": 28, "4872-GB": 28, "4872-70W": 28, "4872-BLI": 28, "4872-01": 28, "4870-SW": 28, "4870-WPP": 28, "4870-NPC": 28, "4870-WPC": 28, "4870-SN": 28, "4870-GB": 28, "4870-WLI": 28, "4870-NLI": 28, "EXLEVC-14": 28, "4870-00": 28, "EXLEVC-15": 28, "4870-BLI": 28, "EXLEVC-12": 28, "EXLEVC-13": 28, "EXLEVC-11": 28, "FLWH4260-01": 28, "4865-WLI": 28, "EX4860-22": 28, "EX4860-23": 28, "FLWH4895-03": 28, "FLWH4895-02": 28, "FLWH4895-01": 28, "FLWH4880-01": 28, "FLWH4880-04": 28, "FLWH4880-02": 28, "FLWH4875-03": 28, "FLWH4880-03": 28, "FLWH4875-04": 28, "FLWH4875-02": 28, "FLWH4875-01": 28, "FLWH4872-02": 28, "FLWH4870-04": 28, "FLWH4870-03": 28, "FLWH4872-04": 28, "FLWH4872-01": 28, "FLWH4870-02": 28, "FLSM4880-03": 28, "FLSL4880-02": 28, "FLSL4872-02": 28, "ET4880-04": 28, "ET4880-02": 28, "ET4870-16": 28, "ET4875-02": 28, "ET4875-16": 28, "ET4870-12": 28, "ET4870-08": 28, "ET4870-14": 28, "E4820-21": 28, "ET4870-06": 28, "ET4870-02": 28, "ET4870-04": 28, "DN4875-01": 28, "FLNV4880-04": 28, "FLNV4872-04": 28, "FLNV4880-03": 28, "FLNT4880-04": 28, "FLNT4880-01": 28, "FLNT4880-02": 28, "FLNT4875-04": 28, "CS1880-B": 28, "FLNT4872-04": 28, "CS1880-18": 28, "CS1880-22": 28, "FLNT4872-02": 28, "FLBK4880-04": 28, "FLNT4872-01": 28, "FLNT4260-04": 28, "FLBK4880-03": 28, "FLBK4880-01": 28, "FLBK4872-04": 28, "FE4865-22": 28, "FE4595-05": 28, "FE4590-05": 28, "FE4585-05": 28, "FE4580-05": 28, "FE4575-05": 28, "FE4565-05": 28, "FE4570-05": 28, "FE4280-22": 28, "FE4280-20": 28, "FE4280-15": 28, "FE4280-17": 28, "FE4280-12": 28, "FE4275-22": 28, "FE4270-22": 28, "FE4265-20": 28, "FE4270-20": 28, "FE4275-20": 28, "FE4270-15": 28, "FE4265-15": 28, "FE4265-18": 28, "FE4270-12": 28, "FB4880-SF": 28, "FB4880-GR": 28, "FB4880-SD": 28, "F-8535-B": 28, "F-8545-B": 28, "F-8565-B": 28, "F-8515-B": 28, "F-4590-B": 28, "F-8505-B": 28, "F-4595-B": 28, "F-4585-B": 28, "F-4575-B": 28, "F-4570-B": 28, "F-4565-B": 28, "F-4580-B": 28, "EX8535-27": 28, "EXLEVC-10": 28, "F-4560-B": 28, "EX8535-13": 28, "EX8535-22": 28, "EX8535-10": 28, "EX8515-26": 28, "EX8515-22": 28, "EX8515-25": 28, "EX4895-13": 28, "EX4860-18": 28, "EX4860-13": 28, "EX4860-12": 28, "EX4860-10": 28, "EX4860-11": 28, "7716-GB": 28, "7716-BLI": 28, "7716-N": 28, "5360-30": 28, "5360-25": 28, "ET4860-14": 28, "5360-15": 28, "5360-08": 28, "4860-GB": 28, "5360-12": 28, "CV900": 28, "CUR-00": 28, "ET4860-16": 28, "ET4860-12": 28, "75472": 28, "75530": 28, "20446": 28, "5360-06": 28, "75423": 28, "EX4894-26": 28, "75399": 28, "10902": 28, "10928": 28, "EX4895-10": 28, "10969": 28, "10936": 28, "TIX-99": 28, "10894": 28, "MINSDQ": 28, "MINBLK": 28, "MINSDS": 28, "LEVC904": 28, "MINSDG": 28, "LEVC903": 28, "LEVC902": 28, "LEVC-GB": 28, "EXLEVC-27": 28, "EXLEVC-26": 28, "EXLEVC-25": 28, "EXLEVC-23": 28, "EXLEVC-22": 28, "EXLEVC-18": 28, "EXLEVC-17": 28, "EX7716-18": 28, "6660-15": 28, "FE-7300-12": 28, "FE-7300-15": 28, "EXP-0286PL": 28, "PC0510PL": 28, "8515-77": 28, "8515-91": 28, "8515-75": 28, "8515-90": 28, "8515-81": 28, "8515-71": 28, "8535-91": 28, "8535-90": 28, "8535-81": 28, "8535-71": 28, "8535-78": 28, "8535-93": 28, "8525-77": 28, "8525-75": 28, "E4820-27": 28, "E4820-25": 28, "E4820-40": 28, "E4820-28": 28, "8575-77": 28, "8575-75": 28, "8575-71": 28, "8575-78": 28, "4890-39": 28, "4890-25": 28, "4890-31": 28, "4870-27": 28, "4870-42": 28, "4870-41": 28, "4870-31": 28, "4870-28": 28, "4875-41": 28, "4875-25": 28, "4875-40": 28, "4875-21": 28, "4880-27": 28, "82992": 28, "4880-41": 28, "4880-07": 28, "4880-25": 28, "4880-40": 28, "4880-31": 28, "4880-28": 28, "4885-27": 28, "4885-28": 28, "4261-14": 28, "72652": 28, "8535-14": 28, "FE-7300-14": 28, "87949": 28, "4875-28": 28, "73234": 28, "4870-25": 28, "77012": 28, "92532": 28, "88982": 28, "8535-75": 28, "30858": 28, "4875-27": 28, "5360-28": 28, "76245": 28, "93770": 28, "22663": 28, "31352": 28, "EX7716-26": 28, "25552": 28, "2356": 28, "88249": 28, "539": 28, "8515-78": 28, "8535-77": 28, "8535-92": 28, "E4820-31": 28, "8575-81": 28, "8565-50": 28, "FA4870-01": 28, "4870-40": 28, "4870-21": 28, "4875-31": 28, "85739": 28, "62929": 28, "28749": 28, "31689": 28, "1COBLK": 28, "E4898-00": 28, "86272": 28, "91867": 28, "4890-21": 28, "76104": 28, "SH4275-02": 28, "83890": 28, "82964": 28, "62945": 28, "87881": 28, "FLWH4260-04": 28, "87519": 28, "78650": 28, "87133": 28, "4890-27": 28, "4885-25": 28, "4260-18": 28, "4260-20": 28, "79152": 28, "11499": 28, "81608": 28, "87543": 28, "34073": 28, "9687": 28, "87348": 28, "72694": 28, "75999": 28, "73354": 28, "72628": 28, "73072": 28, "15497": 28, "77137": 28, "65660": 28, "8535-24": 28, "FA4870-04": 28, "FA4895-07": 28, "87899": 28, "FA4865-04": 28, "5360-29": 28, "EX4897-10": 28, "72771": 28, "FA4870-03": 28, "4261-15": 28, "4897-BLI": 28, "69960": 28, "87923": 28, "73854": 28, "FA4870-06": 28, "4880-21": 28, "FA4895-01": 28, "4056": 28, "R2172": 28, "8535-26": 28, "EX4875-15": 28, "90866": 28, "FA4870-07": 28, "FA4875-06": 28, "27418": 28, "87915": 28, "92938": 28, "MR4870-01": 28, "FA4895-05": 28, "MR4895-02": 28, "LEVC-96": 28, "EX8535-25": 28, "FA4880-06": 28, "FA4880-07": 28, "5360-27": 28, "8535-17": 28, "FLNT4870-04": 28, "MR4870-02": 28, "CUR-97": 28, "EX7716-23": 28, "FA4880-02": 28, "EX4895-12": 28, "SH4275-05": 28, "SH4275-07": 28, "87485": 28, "EX8535-14": 28, "DN4875-02": 28, "5360-24": 28, "73031": 28, "36210": 28, "1840-NPC": 28, "FA4865-02": 28, "R2169": 28, "M8535-15": 28, "R252": 28, "FA4865-03": 28, "FA4865-05": 28, "LUX4897-103": 28, "EX4894-27": 28, "87501": 28, "EX8555-26": 28, "92912": 28, "FA4880-04": 28, "84793": 28, "87477": 28, "EX4897-25": 28, "FA4875-05": 28, "FA4895-06": 28, "SS5605PL": 28, "8535-27": 28, "EX4899-25": 28, "FE4275-17": 28, "LUXLEVC-104": 28, "FA4865-06": 28, "FA4875-01": 28, "5395-04": 28, "ET4875-08": 28, "EX-1840-18": 28, "FA4875-02": 28, "8535-18": 28, "FA4865-01": 28, "FA4880-01": 28, "4260-12": 28, "ET4875-12": 28, "FA4875-07": 28, "DN4880-01": 28, "EX4895-15": 28, "EX4897-18": 28, "73191": 28, "8535-25": 28, "FA4870-05": 28, "SS5603PL": 28, "8535-12": 28, "17330": 28, "EX8535-11": 28, "DN4870-02": 28, "5375-18": 28, "5360-17": 28, "8515-12": 28, "SH4275-06": 28, "87907": 28, "EX8555-27": 28, "FA4870-02": 28, "CUR-98": 28, "4170": 28, "DN4870-01": 28, "FA4875-04": 28, "FA4895-04": 28, "4261-11": 28, "FA4895-02": 28, "1872-08": 28, "DN4895-02": 28, "F-8595-B": 28, "FA4865-07": 28, "FLBK4872-01": 28, "6675-12": 28, "CUR-99": 28, "EX4875-26": 28, "6660-12": 28, "87733": 28, "5375-24": 28, "5375-12": 28, "DN4880-02": 28, "FE8535-20": 28, "LEVC-97": 28, "EX4899-26": 28, "EX4875-25": 28, "5395-12": 28, "5895-GL": 28, "MR4865-02": 28, "6675-13": 28, "EX4895-22": 28, "LUXLEVC-112": 28, "5375-17": 28, "8535-BLI": 28, "5375-27": 28, "FA4895-03": 28, "R2174": 28, "EX4897-13": 28, "FE4275-12": 28, "5375-08": 28, "4885-21": 28, "DN4895-01": 28, "8535-28": 28, "R254": 28, "73098": 28, "EX8535-18": 28, "8595-50": 28, "EX4870-26": 28, "MR4875-02": 28, "5360-18": 28, "4261-18": 28, "EX4897-15": 28, "EX4895-27": 28, "MINSDC": 28, "1855-06": 28, "FA4880-03": 28, "1865-30": 28, "EX7716-14": 28, "LUX-7716-25": 28, "LUXLEVC-103": 28, "1875-30": 28, "MR4875-01": 28, "EX7716-17": 28, "4260-14": 28, "EX4895-14": 28, "78060": 28, "EX8535-23": 28, "S8535-12": 28, "FA4875-03": 28, "5360-11": 28, "EX8515-15": 28, "EX8535-15": 28, "DN4865-02": 28, "FLWH4260-02": 28, "EX4860-26": 28, "EX4897-14": 28, "MR4865-01": 28, "ET4875-04": 28, "EX4897-11": 28, "1840-08": 28, "67211": 28, "8535-11": 28, "M8535-14": 28, "FLWH4260-03": 28, "73015": 28, "EX4897-26": 28, "EX4875-13": 28, "42608": 28, "8505-12": 28, "5375-20": 28, "1COSIL": 28, "EX8515-23": 28, "8585-03": 28, "EX7716-15": 28, "5360-14": 28, "5360-20": 28, "93404": 28, "8515-BLI": 28, "EX4895-26": 28, "EX4897-17": 28, "5375-15": 28, "EX4875-17": 28, "ET4875-06": 28, "1840-07": 28, "R2173": 28, "R2175": 28, "EX8515-12": 28, "R257": 28, "R255": 28, "ET4875-14": 28, "63224": 28, "5375-29": 28, "FE4265-12": 28, "EX7716-12": 28, "5375-11": 28, "EX8515-14": 28, "8535-20": 28, "DN4865-01": 28, "1855-B": 28, "EX8535-17": 28, "5375-14": 28, "EX7716-11": 28, "27419": 28, "LUXLEVC-113": 28, "1840-30": 28, "EX7716-27": 28, "8535-WLI": 28, "5375-25": 28, "EX4897-12": 28, "1875-08": 28, "EX8535-12": 28, "LEVC-99": 28, "EX4895-17": 28, "8535-NLI": 28, "51384": 28, "E4897-50": 28, "F-4561-B": 28, "35548": 28, "R2177": 28, "8535-02": 28, "1872-30": 28, "4261-16": 28, "8515-20": 28, "4260-22": 28, "FLWH4870-01": 28, "LUXLEVC-101": 28, "72660": 28, "4895-NPC": 28, "EX-1855-18": 28, "SH4275-04": 28, "LUXLEVC-102": 28, "73056": 28, "F-8585-B": 28, "EX4860-17": 28, "1855-NPC": 28, "1895-08": 28, "EX4897-22": 28, "EX4875-27": 28, "4260-21": 28, "11816": 28, "EX8515-27": 28, "EX8535-26": 28, "CV901": 28, "EN5603": 28, "EX4865-26": 28, "1865-06": 28, "EX4875-12": 28, "EX4895-25": 28, "28815": 28, "1840-06": 28, "1870-08": 28, "SIVV919": 28, "FE-7300-13": 28, "EX-1865-18": 28, "89129": 28, "EX7716-13": 28, "4261-22": 28, "8535-07": 28, "R253": 28, "FA4880-05": 28, "72686": 28, "EN6303": 28, "1895-B": 28, "EX4895-23": 28, "LUXLEVC-106": 28, "EX4897-27": 28, "1895-NPC": 28, "EX7716-10": 28, "EX4870-25": 28, "1872-07": 28, "1875-06": 28, "5375-26": 28, "R2176": 28, "R249": 28, "EX7716-22": 28, "17318": 28, "1870-30": 28, "EX4875-19": 28, "5360-07": 28, "1855-08": 28, "SH4275-08": 28, "5360-02": 28, "1875-07": 28, "4058": 28, "1855-07": 28, "MR4895-01": 28, "8535-15": 28, "EX4895-11": 28, "SH4275-01": 28, "EX-1895-18": 28, "4895-00": 28, "95157": 28, "LEVC-98": 28, "EX8515-10": 28, "7716-B": 28, "1840-B": 28, "1840-WPC": 28, "EX4899-27": 28, "EX-1872-18": 28, "EX8515-17": 28, "28817": 28, "8535-04": 28, "EX4875-18": 28, "4260-16": 28, "SH4275-03": 28, "4860-WGB": 28, "6660-11": 28, "67146": 28, "8535-03": 28, "1865-B": 28, "1865-08": 28, "6675-15": 28, "5375-04": 28, "EX-1880-18": 28, "LUX-1801-B": 28, "1855-WPC": 28, "EX4897-23": 28, "8535-NPC": 28, "1855-30": 28, "EX-1875-18": 28, "R256": 28, "EX4894-25": 28, "726781": 28, "PC1801PL": 28, "1872-B": 28, "6660-14": 28, "6660-13": 28, "1880-08": 28, "1801-01": 28, "67229": 28, "4261-20": 28, "1865-07": 28, "1895-06": 28, "FE4275-15": 28, "5395-11": 28, "EX8555-25": 28, "EX-1870-18": 28, "1870-06": 28, "1875-B": 28, "1870-B": 28, "1880-30": 28, "8505-15": 28, "8515-15": 28, "11824": 28, "28830": 28, "1895-30": 28, "4261-12": 28, "75571": 28, "SIVV917": 28, "5395-20": 28, "75498": 28, "11009": 28, "17871": 28, "SIVV915": 28, "67153": 28, "1895-07": 28, "5360-26": 28, "1870-07": 28, "50723": 28, "1801-GB": 28, "14257": 28, "1801-06": 28, "8503-AO": 28, "EX8515-11": 28, "5360-04": 28, "72991": 28, "8595-03": 28, "65920": 28, "1880-NPC": 28, "1895-WPC": 28, "6675-16": 28, "EX8515-13": 28, "F-4550-B": 28, "1880-B": 28, "1872-06": 28, "5869-01": 28, "1880-07": 28, "17855": 28, "1801-W": 28, "5895-01": 28, "1880-06": 28, "1880-WPC": 28, "90417": 28, "10686": 28, "1590": 28, "16162": 28, "1865-NPC": 28, "1865-WPC": 28, "1870-NPC": 28, "1870-WPC": 28, "1872-NPC": 28, "1872-WPC": 28, "1875-NPC": 28, "1875-WPC": 28, "20578": 28, "26673": 28, "28791": 28, "41779": 28, "4260-15": 28, "44410": 28, "4561-01": 28, "4855-NLI": 28, "4855-NPC": 28, "4855-WLI": 28, "4855-WPC": 28, "4875-NLI": 28, "4875-NPC": 28, "4875-WLI": 28, "4897-GB": 28, "53440": 28, "57883": 28, "5850-01": 28, "5869-GL": 28, "5875-01": 28, "5875-GL": 28, "60190": 28, "6095-01": 28, "61549": 28, "65797": 28, "65888": 28, "65896": 28, "65904": 28, "65912": 28, "65938": 28, "6660-16": 28, "72924": 28, "72932": 28, "72973": 28, "7305-01": 28, "7534": 28, "7716": 28, "7773": 28, "83478": 28, "85923": 28, "88094": 28, "88102": 28, "89150": 28, "92908": 28, "96620": 28, "98149": 28, "99966": 28, "ET4860-02": 28, "ET4860-04": 28, "ET4860-06": 28, "ET4860-08": 28, "EX4860-14": 28, "EX4860-15": 28, "EX4860-25": 28, "EX4860-27": 28, "FFW-10": 28, "FFW-1013": 28, "PHGC1": 28, "8535-13": 28, "R3867": 28, "R3870": 28, "R3871": 28, "R3872": 28, "R3873": 28, "R3874": 28, "R3875": 28, "1644-06": 28, "1644-07": 28, "1644-BLI": 28, "1644-NLI": 28, "1644-WLI": 28, "1CO-01": 28, "1COGB": 28, "1COGLD": 28, "4820-06": 28, "4820-07": 28, "4820-BLI": 28, "4820-NLI": 28, "4820-WLI": 28, "4894-06": 28, "4894-07": 28, "4894-BLI": 28, "4894-NLI": 28, "4894-WLI": 28, "4895-70W": 28, "72973-01": 28, "72973-80W": 28, "72973-GB": 28, "8503-01": 28, "8503-GB": 28, "8504-01": 28, "8504-GB": 28, "8520-01": 28, "8520-70W": 28, "8520-BLI": 28, "8520-GB": 28, "8520-NLI": 28, "8520-SW": 28, "8520-WLI": 28, "8520-WPC": 28, "8530-01": 28, "8530-70W": 28, "8530-BLI": 28, "8530-GB": 28, "8530-NLI": 28, "8530-SW": 28, "8530-WLI": 28, "8530-WPC": 28, "8635-W": 28, "LUX-1644-112": 28, "LUX-1644-113": 28, "LUX-1CO-05": 28, "LUX-1CO-10": 28, "LUX-1CO-102": 28, "LUX-1CO-103": 28, "LUX-1CO-11": 28, "LUX-1CO-112": 28, "LUX-1CO-12": 28, "LUX-1CO-13": 28, "LUX-1CO-17": 28, "LUX-1CO-18": 28, "LUX-1CO-22": 28, "LUX-1CO-25": 28, "LUX-1CO-L17": 28, "LUX-1CO-L22": 28, "LUX-4820-112": 28, "LUX-4894-112": 28, "LUX-4894-113": 28, "LUX-4899-102": 28, "LUX-4899-112": 28, "LUX-4899-113": 28, "LUX-72973-B": 28, "LUX-8520-103": 28, "LUX-8520-B": 28, "LUX-8530-103": 28, "LUX-8530-B": 28, "1218-P-60T15": 28, "1319-P-60T15": 28, "81211-C-100": 28, "81211-C-101": 28, "81211-C-102": 28, "81211-C-104": 28, "81211-P-100": 28, "81211-P-101": 28, "81211-P-102": 28, "81211-P-104": 28, "81211-C-BLI": 28, "81211-C-L20": 28, "81211-C-L17": 28, "81211-C-L05": 28, "81211-C-199": 28, "81211-C-L07": 28, "81211-C-198": 28, "81211-C-113": 28, "81211-C-112": 28, "81211-C-197": 28, "81211-C-L22": 28, "81211-C-106": 28, "81211-C-196": 28, "81211-P-BLI": 28, "81211-P-L20": 28, "81211-P-L17": 28, "81211-P-L05": 28, "81211-P-199": 28, "81211-P-L07": 28, "81211-P-198": 28, "81211-P-113": 28, "81211-P-112": 28, "81211-P-197": 28, "81211-P-L22": 28, "81211-P-106": 28, "81211-C-03": 28, "81211-C-04": 28, "81211-C-05": 28, "81211-C-06": 28, "81211-C-07": 28, "81211-C-08": 28, "81211-C-10": 28, "81211-C-12": 28, "81211-C-13": 28, "81211-C-14": 28, "81211-C-17": 28, "81211-C-18": 28, "81211-C-20": 28, "81211-C-22": 28, "81211-C-23": 28, "81211-C-25": 28, "81211-C-26": 28, "81211-C-27": 28, "81211-C-29": 28, "81211-C-30": 28, "81211-C-32": 28, "81211-C-34": 28, "81211-C-35": 28, "81211-C-36": 28, "81211-C-38": 28, "81211-C-39": 28, "81211-C-40": 28, "81211-C-41": 28, "81211-C-43": 28, "81211-C-44": 28, "81211-C-45": 28, "81211-C-46": 28, "81211-C-49": 28, "81211-C-50": 28, "81211-C-52": 28, "81211-C-53": 28, "81211-C-55": 28, "81211-C-56": 28, "81211-C-57": 28, "81211-C-58": 28, "81211-C-59": 28, "81211-C-60": 28, "81211-C-61": 28, "81211-C-63": 28, "81211-C-64": 28, "81211-C-65": 28, "81211-C-66": 28, "81211-C-67": 28, "81211-C-68": 28, "81211-C-69": 28, "81211-C-71": 28, "81211-C-72": 28, "81211-C-75": 28, "81211-C-76": 28, "81211-C-77": 28, "81211-C-78": 28, "81211-C-79": 28, "81211-C-80": 28, "81211-C-83": 28, "81211-C-84": 28, "81211-C-86": 28, "81211-C-87": 28, "81211-C-88": 28, "81211-C-89": 28, "81211-C-90": 28, "81211-C-98": 28, "81211-C-99": 28, "81211-C-SN": 28, "81211-C-SW": 28, "81211-P-02": 28, "81211-P-03": 28, "81211-P-04": 28, "81211-P-05": 28, "81211-P-06": 28, "81211-P-07": 28, "81211-P-08": 28, "81211-P-09": 28, "81211-P-10": 28, "81211-P-12": 28, "81211-P-13": 28, "81211-P-14": 28, "81211-P-15": 28, "81211-P-16": 28, "81211-P-17": 28, "81211-P-18": 28, "81211-P-20": 28, "81211-P-22": 28, "81211-P-23": 28, "81211-P-25": 28, "81211-P-26": 28, "81211-P-27": 28, "81211-P-29": 28, "81211-P-32": 28, "81211-P-34": 28, "81211-P-35": 28, "81211-P-36": 28, "81211-P-38": 28, "81211-P-39": 28, "81211-P-40": 28, "81211-P-41": 28, "81211-P-42": 28, "81211-P-43": 28, "81211-P-44": 28, "81211-P-45": 28, "81211-P-46": 28, "81211-P-49": 28, "81211-P-50": 28, "81211-P-51": 28, "81211-P-52": 28, "81211-P-53": 28, "81211-P-55": 28, "81211-P-56": 28, "81211-P-57": 28, "81211-P-58": 28, "81211-P-59": 28, "81211-P-60": 28, "81211-P-61": 28, "81211-P-63": 28, "81211-P-64": 28, "81211-P-65": 28, "81211-P-66": 28, "81211-P-67": 28, "81211-P-68": 28, "81211-P-69": 28, "81211-P-70": 28, "81211-P-71": 28, "81211-P-72": 28, "81211-P-74": 28, "81211-P-75": 28, "81211-P-76": 28, "81211-P-77": 28, "81211-P-78": 28, "81211-P-79": 28, "81211-P-80": 28, "81211-P-83": 28, "81211-P-84": 28, "81211-P-86": 28, "81211-P-87": 28, "81211-P-88": 28, "81211-P-89": 28, "81211-P-90": 28, "81211-P-98": 28, "81211-P-99": 28, "81211-P-SN": 28, "81211-P-SW": 28, "1218-C-M04": 28, "1218-C-M05": 28, "1218-C-M02": 28, "1218-C-M07": 28, "1218-C-BLI": 28, "1218-C-M22": 28, "1218-C-M27": 28, "1218-C-M30": 28, "1218-C-M35": 28, "1218-C-M36": 28, "1218-C-M38": 28, "1218-C-M40": 28, "1218-C-L17": 28, "1218-C-M49": 28, "1218-C-M50": 28, "1218-C-101": 28, "1218-C-NLI": 28, "1218-C-103": 28, "1218-C-102": 28, "1218-C-M71": 28, "1218-C-M08": 28, "1218-C-M75": 28, "1218-C-M77": 28, "1218-C-113": 28, "1218-C-M06": 28, "1218-C-112": 28, "1218-C-104": 28, "1218-C-M89": 28, "1218-C-L22": 28, "1218-C-WLI": 28, "1218-C-106": 28, "1218-P-M04": 28, "1218-P-M05": 28, "1218-P-M02": 28, "1218-P-M07": 28, "1218-P-BLI": 28, "1218-P-M22": 28, "1218-P-M27": 28, "1218-P-M30": 28, "1218-P-M35": 28, "1218-P-M36": 28, "1218-P-M38": 28, "1218-P-M40": 28, "1218-P-L17": 28, "1218-P-M49": 28, "1218-P-M50": 28, "1218-P-101": 28, "1218-P-NLI": 28, "1218-P-103": 28, "1218-P-102": 28, "1218-P-M71": 28, "1218-P-M08": 28, "1218-P-M75": 28, "1218-P-M77": 28, "1218-P-113": 28, "1218-P-M06": 28, "1218-P-112": 28, "1218-P-104": 28, "1218-P-M89": 28, "1218-P-L22": 28, "1218-P-WLI": 28, "1218-P-106": 28, "1319-C-M04": 28, "1319-C-M05": 28, "1319-C-M02": 28, "1319-C-M07": 28, "1319-C-BLI": 28, "1319-C-M22": 28, "1319-C-M27": 28, "1319-C-M30": 28, "1319-C-M35": 28, "1319-C-M36": 28, "1319-C-M38": 28, "1319-C-M40": 28, "1319-C-L17": 28, "1319-C-M49": 28, "1319-C-M50": 28, "1319-C-101": 28, "1319-C-NLI": 28, "1319-C-103": 28, "1319-C-102": 28, "1319-C-M71": 28, "1319-C-M08": 28, "1319-C-M75": 28, "1319-C-M77": 28, "1319-C-113": 28, "1319-C-M06": 28, "1319-C-112": 28, "1319-C-104": 28, "1319-C-M89": 28, "1319-C-L22": 28, "1319-C-WLI": 28, "1319-C-106": 28, "1319-P-M04": 28, "1319-P-M05": 28, "1319-P-M02": 28, "1319-P-M07": 28, "1319-P-BLI": 28, "1319-P-M22": 28, "1319-P-M27": 28, "1319-P-M30": 28, "1319-P-M35": 28, "1319-P-M36": 28, "1319-P-M38": 28, "1319-P-M40": 28, "1319-P-L17": 28, "1319-P-M49": 28, "1319-P-M50": 28, "1319-P-101": 28, "1319-P-NLI": 28, "1319-P-103": 28, "1319-P-102": 28, "1319-P-M71": 28, "1319-P-M08": 28, "1319-P-M75": 28, "1319-P-M77": 28, "1319-P-113": 28, "1319-P-M06": 28, "1319-P-112": 28, "1319-P-104": 28, "1319-P-M89": 28, "1319-P-L22": 28, "1319-P-WLI": 28, "1319-P-106": 28, "81211-P-30": 28, "FFW-10-103": 28, "FFW-10-L20": 28, "FFW-10-L22": 28, "FFW-69-103": 28, "FFW-69-L22": 28, "FFW-69-L20": 28, "1218-C-13": 28, "1218-C-23": 28, "1218-C-14": 28, "1218-C-17": 28, "1218-C-20": 28, "1218-C-26": 28, "1218-C-15": 28, "1218-C-05": 28, "1218-C-10": 28, "1218-C-11": 28, "1218-C-57": 28, "1218-C-07": 28, "1218-C-60": 28, "1218-C-61": 28, "1218-C-18": 28, "1218-C-79": 28, "1218-C-22": 28, "1218-C-83": 28, "1218-C-12": 28, "1218-C-25": 28, "1218-C-87": 28, "1218-C-88": 28, "1218-P-13": 28, "1218-P-23": 28, "1218-P-14": 28, "1218-P-17": 28, "1218-P-20": 28, "1218-P-26": 28, "1218-P-15": 28, "1218-P-05": 28, "1218-P-10": 28, "1218-P-11": 28, "1218-P-57": 28, "1218-P-07": 28, "1218-P-60": 28, "1218-P-61": 28, "1218-P-18": 28, "1218-P-79": 28, "1218-P-22": 28, "1218-P-83": 28, "1218-P-12": 28, "1218-P-25": 28, "1218-P-87": 28, "1218-P-88": 28, "1319-C-13": 28, "1319-C-23": 28, "1319-C-14": 28, "1319-C-17": 28, "1319-C-20": 28, "1319-C-26": 28, "1319-C-15": 28, "1319-C-05": 28, "1319-C-10": 28, "1319-C-11": 28, "1319-C-57": 28, "1319-C-07": 28, "1319-C-60": 28, "1319-C-61": 28, "1319-C-18": 28, "1319-C-79": 28, "1319-C-22": 28, "1319-C-83": 28, "1319-C-12": 28, "1319-C-25": 28, "1319-C-87": 28, "1319-C-88": 28, "1319-P-13": 28, "1319-P-23": 28, "1319-P-14": 28, "1319-P-17": 28, "1319-P-20": 28, "1319-P-26": 28, "1319-P-15": 28, "1319-P-05": 28, "1319-P-10": 28, "1319-P-11": 28, "1319-P-57": 28, "1319-P-07": 28, "1319-P-60": 28, "1319-P-61": 28, "1319-P-18": 28, "1319-P-79": 28, "1319-P-22": 28, "1319-P-83": 28, "1319-P-12": 28, "1319-P-25": 28, "1319-P-87": 28, "1319-P-88": 28, "INVDW-L20": 28, "INVDW-L22": 28, "FFW-10-GB": 28, "FFW-10-18": 28, "FFW-69-18": 28, "FFW-69-GB": 28, "1218-C-B": 28, "1218-P-B": 28, "1319-C-B": 28, "1319-P-B": 28, "INVDW-18": 28, "FFW-10-B": 28, "FFW-69-B": 28, "INVDW-B": 28, "1865-GB": 28, "1872-GB": 28, "1875-GB": 28, "1870-GB": 28, "1880-GB": 28, "1895-GB": 28, "1212-P-61": 28, "1212-P-57": 28, "1212-P-M89": 28, "1212-P-M04": 28, "1212-P-L05": 28, "1212-P-106": 28, "1212-P-26": 28, "1212-P-18": 28, "1212-P-30": 28, "1212-P-B": 28, "1212-P-22": 28, "1212-P-M22": 28, "1212-P-88": 28, "1212-P-17": 28, "1212-P-NLI": 28, "1212-P-WPQ": 28, "1212-P-M38": 28, "1212-P-M77": 28, "1212-P-M50": 28, "1212-P-M02": 28, "1212-P-113": 28, "1212-P-104": 28, "1212-P-M75": 28, "1212-P-M24": 28, "1212-P-08": 28, "1212-P-M08": 28, "1212-P-06": 28, "1212-P-M05": 28, "1212-P-M27": 28, "1212-P-L07": 28, "1212-P-112": 28, "1212-P-60": 28, "1212-P-11": 28, "1212-P-L20": 28, "1212-P-15": 28, "1212-P-12": 28, "1212-P-M36": 28, "1212-P-103": 28, "1212-P-102": 28, "1212-P-79": 28, "1212-P-25": 28, "1212-P-83": 28, "1212-P-14": 28, "1212-P-10": 28, "1212-P-60T15": 28, "1212-P-M07": 28, "1212-P-GB": 28, "1212-P-BLI": 28, "1212-P-M35": 28, "1212-P-L22": 28, "1212-P-L17": 28, "1212-P-101": 28, "1212-P-23": 28, "1212-P-13": 28, "1212-P-M71": 28, "1212-P-M49": 28, "1212-P-87": 28, "1212-P-07": 28, "LUX-PF-L20": 28, "PF-GB": 28, "1212-P-WGV": 28, "LUX-PF-12": 28, "LUX-PF-L22": 28, "LUX-PF-L17": 28, "LUX-PF-56": 28, "PF-130W": 28, "PF-WLI": 28, "LUX-A7FFW-103": 28, "LUX-A7FFW-18": 28, "A7FFW-B": 28, "A7FFW-GB": 28, "A7FFW-28W": 28, "BP-INM811": 28, "1212-P-WCN": 28, "1212-P-WLI": 28, "1212-P-80W": 28, "LUX-PF-102": 28, "BP-INM665": 28, "BP-INM1217": 28, "BP-INM1115": 28, "CON-HDC3": 28, "CON-HDC2": 28, "CON-HDC1": 28, "CON-CMT": 28, "CON-PM2": 28, "CON-PM1": 28, "CON-CMP": 28, "AIR378-18": 28, "AIR378-M07": 28, "AIR378-103": 28, "LUX-512CO-103": 28, "LUX-512CO-B": 28, "LUX-8575-18": 28, "8575-07": 28, "8575-06": 28, "8565-06": 28, "LUX-8565-18": 28, "LUX-8585-18": 28, "8503-M07": 28, "8503-M08": 28, "8585-07": 28, "LUX-512CO-06": 28, "LUX-512CO-07": 28, "LUX-512CO-18": 28, "LUX-512CO-22": 28, "LUX-512CO-102": 28, "8585-06": 28, "LUX-8545-18": 28, "8545-07": 28, "8545-06": 28, "8565-07": 28, "1644-GB": 28, "R0260": 28, "R0264": 28, "R0266": 28, "R0267": 28, "R0265": 28, "1212-C-M38": 28, "1212-C-112": 28, "1212-C-101": 28, "1212-C-61": 28, "1212-C-102": 28, "1212-C-M71": 28, "1212-C-106": 28, "1212-C-M24": 28, "LUX-512CO-GB": 28, "SDI-24WW": 28, "LDI-24WW": 28, "LUX-1801-10": 28, "LUX-1801-102": 28, "1212-C-60": 28, "1212-C-11": 28, "1212-C-57": 28, "1212-C-M89": 28, "1212-C-79": 28, "1212-C-M04": 28, "1212-C-104": 28, "LUX-1801-101": 28, "LUX-1801-103": 28, "LUX-1801-11": 28, "LUX-1801-22": 28, "LUX-1801-12": 28, "LUX-1801-L20": 28, "LUX-1801-L17": 28, "LUX-1801-L22": 28, "1COCHAMP": 28, "1COBLON": 28, "1212-C-L20": 28, "1212-C-15": 28, "1212-C-12": 28, "1212-C-M36": 28, "1212C-M77": 28, "1212-C-M77": 28, "1212-C-M50": 28, "1212-C-M02": 28, "1212-C-25": 28, "1212-C-23": 28, "1212-C-L05": 28, "1212-C-M75": 28, "1212-C-14": 28, "LUX-8530-18": 28, "1COJUP": 28, "1COGK": 28, "LEVC-BLI": 28, "LEVC-WLI": 28, "LEVC-NLI": 28, "8530-07": 28, "8530-06": 28, "1212-C-M35": 28, "1212-C-L22": 28, "1212-C-L17": 28, "1212-C-113": 28, "1212-C-103": 28, "1212-C-13": 28, "1212-C-10": 28, "1212-C-184SN": 28, "1212-C-L07": 28, "1212-C-83": 28, "1212-C-N": 28, "1212-C-NLI": 28, "1212-C-M49": 28, "1212-C-87": 28, "1212-C-26": 28, "1212-C-18": 28, "1212-C-M08": 28, "1212-C-236SBW": 28, "1212-C-W": 28, "1212-C-WLI": 28, "1212-C-M07": 28, "1212-C-08": 28, "81211-C-18GB": 28, "1212-C-07": 28, "1212-C-30": 28, "1212-C-06": 28, "1319-C-18GB": 28, "1218-C-18GB": 28, "1212-C-M05": 28, "1212-C-BLI": 28, "1212-C-B": 28, "1212-C-22": 28, "1212-C-M27": 28, "1212-C-M22": 28, "1212-C-88": 28, "1212-C-17": 28, "1212-C-236SN": 28, "61112-B": 28, "LUX-SPB-22": 28, "SPB-06": 28, "1212-C-92GG": 28, "1218-C-92GG": 28, "1801-H01": 28, "1801-H02": 28, "61112-24BK": 28, "61112-28BK": 28, "61112-GK": 28, "LEVC-H01": 28, "LEVC-H02": 28, "1CO-HOLI": 28, "1CO-CHALK": 28, "SCUBE-17": 28, "SCUBE-GB": 28, "SCUBE-22": 28, "SCUBE-BLI": 28, "SCUBE-06": 28, "SCUBE-07": 28, "SCUBE-M07": 28, "SCUBE-M08": 28, "SCUBE-26": 28, "SCUBE-10": 28, "SCUBE-106": 28, "SCUBE-103": 28, "SCUBE-113": 28, "SCUBE-L17": 28, "SCUBE-L22": 28, "SCUBE-12": 28, "SCUBE-L20": 28, "SCUBE-11": 28, "MCUBE-GB": 28, "MCUBE-22": 28, "MCUBE-BLI": 28, "MCUBE-06": 28, "MCUBE-07": 28, "MCUBE-M07": 28, "MCUBE-M08": 28, "MCUBE-26": 28, "MCUBE-10": 28, "MCUBE-106": 28, "MCUBE-103": 28, "MCUBE-113": 28, "MCUBE-L17": 28, "MCUBE-L22": 28, "MCUBE-12": 28, "MCUBE-L20": 28, "MCUBE-11": 28, "SPB-GB": 28, "SPB-BLI": 28, "SPB-07": 28, "LUX-SPB-18": 28, "LUX-SPB-10": 28, "LUX-SPB-103": 28, "LUX-SPB-L17": 28, "LUX-SPB-L22": 28, "LUX-SPB-12": 28, "LUX-SPB-L20": 28, "LUX-SPB-11": 28, "LUX-MPB-22": 28, "MPB-BLI": 28, "MPB-06": 28, "MPB-07": 28, "LUX-MPB-18": 28, "LUX-MPB-10": 28, "LUX-MPB-103": 28, "LUX-MPB-L17": 28, "LUX-MPB-L22": 28, "MPB-GB": 28, "LUX-MPB-12": 28, "LUX-MPB-L20": 28, "LUX-MPB-11": 28, "MCUBE-112": 28, "MCUBE-17": 28, "INVDW-28BK": 28, "INVDW-GB": 28, "INVDW-102": 28, "INVDW-11": 28, "28728": 28, "28726": 28, "10BS-28W": 28, "10BS-28BK": 28, "10BS-GB": 28, "10BS-07": 28, "LUX-10BS-18": 28, "LUX-10BS-103": 28, "10BS-B": 28, "HD-E054": 28, "HD-E055": 28, "HD-E056": 28, "4BAR-WLI": 28, "4BAR-NLI": 28, "4BAR-BLI": 28, "4BAR-SBW": 28, "4BAR-SN": 28, "4BAR-SG": 28, "4BAR-B": 28, "4BAR-06": 28, "4BAR-GB": 28, "4BAR-07": 28, "LUX-4BAR-18": 28, "LUX-4BAR-103": 28, "512BAR-WLI": 28, "512BAR-NLI": 28, "512BAR-BLI": 28, "512BAR-SBW": 28, "512BAR-SN": 28, "512BAR-SG": 28, "512BAR-B": 28, "512BAR-06": 28, "512BAR-GB": 28, "512BAR-07": 28, "LUX-512BAR-18": 28, "LUX-512BAR-103": 28, "LEEBAR-WLI": 28, "LEEBAR-NLI": 28, "LEEBAR-BLI": 28, "LEEBAR-SBW": 28, "LEEBAR-SG": 28, "LEEBAR-B": 28, "LEEBAR-06": 28, "LEEBAR-07": 28, "LEEBAR-18": 28, "LEEBAR-103": 28, "WS-2652": 28, "WS-3322": 28, "WS-7484": 28, "WS-3880": 28, "WS-7496": 28, "WS-7494": 28, "LUX-4590-102": 28, "LUX-LEEBAR-18": 28, "LUX-LEEBAR-103": 28, "LINER-GB": 28, "LINER-M22": 28, "LINER-M27": 28, "LINER-M05": 28, "LINER-M06": 28, "LINER-M30": 28, "LINER-M07": 28, "LINER-BLON": 28, "LINER-CHAM": 28, "LINER-M08": 28, "LINER-M49": 28, "LINER-M24": 28, "LINER-M75": 28, "LINER-M04": 28, "LINER-M02": 28, "LINER-M50": 28, "LINER-M77": 28, "LINER-M89": 28, "LINER-M36": 28, "LINER-M38": 28, "LEEBAR-GB": 28, "LEPF-BLI": 28, "LEPF-DBLI": 28, "LEPF-NLI": 28, "LEPF-PLI": 28, "LEPF-WLI": 28, "LEPF-W": 28, "1117-P-GB": 28, "1117-P-80W": 28, "1117-P-B": 28, "1117-P-18": 28, "1117-P-26": 28, "1117-P-60T15": 28, "1117-P-10": 28, "1117-P-14": 28, "1117-P-L05": 28, "1117-P-104": 28, "1117-P-106": 28, "1117-P-113": 28, "1117-P-13": 28, "1117-P-102": 28, "1117-P-103": 28, "1117-P-25": 28, "1117-P-L17": 28, "1117-P-L22": 28, "1117-P-12": 28, "1117-P-15": 28, "1117-P-L20": 28, "1117-P-11": 28, "1117-P-112": 28, "1117-P-L07": 28, "1117-P-17": 28, "1117-P-M49": 28, "1117-P-M24": 28, "1117-P-M75": 28, "1117-P-M04": 28, "1117-P-M02": 28, "1117-P-M50": 28, "1117-P-M77": 28, "1117-P-M89": 28, "1117-P-M36": 28, "1117-P-M38": 28, "1117-P-M08": 28, "1117-P-M30": 28, "1117-P-M22": 28, "1117-P-M27": 28, "1117-P-M05": 28, "1117-P-M06": 28, "1117-P-M07": 28, "1117-P-WCN": 28, "1117-P-WGV": 28, "1117-P-WLI": 28, "1117-P-NLI": 28, "1117-P-BLI": 28, "1117-P-WPQ": 28, "1117-P-79": 28, "1117-P-83": 28, "1117-C-18GB": 28, "1117-C-B": 28, "1117-C-N": 28, "1117-C-W": 28, "1117-C-18": 28, "1117-C-26": 28, "1117-C-10": 28, "1117-C-14": 28, "1117-C-L05": 28, "1117-C-104": 28, "1117-C-106": 28, "1117-C-113": 28, "1117-C-13": 28, "1117-C-102": 28, "1117-C-103": 28, "1117-C-25": 28, "1117-C-L17": 28, "1117-C-L22": 28, "1117-C-12": 28, "1117-C-15": 28, "1117-C-L20": 28, "1117-C-11": 28, "1117-C-112": 28, "1117-C-L07": 28, "1117-C-17": 28, "1117-C-22": 28, "1117-C-M49": 28, "1117-C-M24": 28, "1117-C-M75": 28, "1117-C-M04": 28, "1117-C-M02": 28, "1117-C-M50": 28, "1117-C-M77": 28, "1117-C-M89": 28, "1117-C-M36": 28, "1117-C-M38": 28, "1117-C-M08": 28, "1117-C-M22": 28, "1117-C-M27": 28, "1117-C-M05": 28, "1117-C-M06": 28, "1117-C-M07": 28, "1117-C-WLI": 28, "1117-C-NLI": 28, "1117-C-BLI": 28, "1117-C-79": 28, "1117-C-83": 28, "512CO-BP": 28, "512CO-BO": 28, "WS-2956": 28, "WS-2574": 28, "WS-3230": 28, "WS-3133": 28, "WS-3130": 28, "WS-2592": 28, "WS-2032": 28, "WS-2033": 28, "WS-2037": 28, "WS-2038": 28, "WS-2041": 28, "WS-2043": 28, "WS-2034": 28, "WS-2036": 28, "WS-2040": 28, "WS-5248": 28, "WS-5200": 28, "WS-0072": 28, "WS-0073": 28, "WS-0069": 28, "WS-4604": 28, "WS-4918": 28, "WS-4644": 28, "WS-3736": 28, "WS-3720": 28, "WS-3680": 28, "WS-5102": 28, "WS-5221": 28, "WS-5222": 28, "WS-6946": 28, "GLASS-07": 28, "GLASS-13": 28, "GLASS-23": 28, "WS-1624": 28, "81211-P-24IJ": 28, "81211-P-32IJ": 28, "81211-P-M09": 28, "KHF-BLI": 28, "KHF-WLI": 28, "KHF-NLI": 28, "KHF-W": 28, "49F-BLI": 28, "49F-NLI": 28, "49F-WLI": 28, "49F-W": 28, "WS-2960": 28, "WS-2961": 28, "26611-MI": 28, "28460-MI": 28, "WS-3269": 28, "WS-3270": 28, "WS-4870": 28, "LUX-PF-13": 28, "51867-MI": 28, "39892-MI": 28, "80132-MI": 28, "5370-M09": 28, "5365-M09": 28, "81214-P-13": 28, "81214-P-23": 28, "81214-P-14": 28, "81214-P-17": 28, "81214-P-L20": 28, "81214-P-26": 28, "81214-P-L17": 28, "81214-P-60T15": 28, "81214-P-15": 28, "81214-P-L05": 28, "81214-P-101": 28, "81214-P-10": 28, "81214-P-11": 28, "81214-P-103": 28, "81214-P-L07": 28, "81214-P-102": 28, "81214-P-18": 28, "81214-P-113": 28, "81214-P-22": 28, "81214-P-12": 28, "81214-P-112": 28, "81214-P-25": 28, "81214-P-104": 28, "81214-P-L22": 28, "81214-P-106": 28, "WS-0067": 28, "WS-0068": 28, "WS-0071": 28, "WS-0074": 28, "WS-0075": 28, "WS-0076": 28, "WS-0078": 28, "5380-M09": 28, "WS-3342": 28, "7716-28BK": 28, "7716-28W": 28, "LEVC-CT": 28, "512CO-28BK": 28, "512CO-28W": 28, "WS-5480": 28, "WS-0056": 28, "WS-1128": 28, "45313": 28, "1218-C-130GG": 28, "1319-C-130GG": 28, "1319-C-92GG": 28, "69GB": 28, "1644-32IJ": 28, "8555-07": 28, "8555-06": 28, "WS-4894-ST": 28, "LUX-PF-15": 28, "LUX-PF-112": 28, "LUX-PF-104": 28, "LUX-PF-106": 28, "4010-MET-14": 28, "4010-MET-28": 28, "5010-MET-14": 28, "5010-MET-28": 28, "4020-MET-14": 28, "4020-MET-28": 28, "5020-MET-14": 28, "5020-MET-28": 28, "4872-M09": 28, "5375-M09": 28, "4030-MET-14": 28, "4030-MET-28": 28, "5030-MET-14": 28, "5030-MET-28": 28, "4040-MET-14": 28, "4040-MET-28": 28, "5040-MET-14": 28, "5040-MET-28": 28, "A7PTLGB": 28, "4060-MET-28": 28, "5060-MET-14": 28, "5060-MET-28": 28, "WS-2371": 28, "1801-80N": 28, "MPB-NLI": 28, "MPB-WLI": 28, "WS-3876": 28, "WS-3878": 28, "RFID-PPS": 28, "SPB-NLI": 28, "SPB-WLI": 28, "1CO-80N": 28, "LUX512BAR-18": 28, "LUX512BAR-103": 28, "1117P-6-0T15": 28, "A7BB-MS03": 28, "4880-RK70": 28, "81211-C-MS01": 28, "81214-C-M04": 28, "81214-C-M05": 28, "81214-C-M06": 28, "81214-C-M38": 28, "81214-C-M50": 28, "1117-J-GK": 28, "FFW-912-B": 28, "FFW-912-L22": 28, "1CO-BLI": 28, "10BS-WLI": 28, "SPW10W-80PW": 28, "SPW10W-80SW": 28, "4261-24IJ": 28, "LEVC-S03": 28, "1801-NLI": 28, "LEEINNER-SBW": 28, "WINOUTER-SBW": 28, "8525-07": 28, "8525-06": 28, "4010-M09": 28, "5010-M09": 28, "4020-M09": 28, "4020-S03": 28, "5020-M09": 28, "4870-RE70W": 28, "5370-S01": 28, "5370-S03": 28, "5370-S02": 28, "4030-M09": 28, "5030-M09": 28, "4875-RO70N": 28, "4875-RE70W": 28, "A7BB-MS02": 28, "A7BB-MS01": 28, "LINER-MS02": 28, "LINER-S01": 28, "LINER-MS03": 28, "LINER-MS01": 28, "LINER-S03": 28, "LINER-S02": 28, "4040-M09": 28, "4040-S03": 28, "4040-S02": 28, "4040-MS02": 28, "4040-MS03": 28, "5040-M09": 28, "4880-RO70N": 28, "4880-RE70W": 28, "4880-24IJ": 28, "4880-32IJ": 28, "5370-MS02": 28, "5370-MS03": 28, "5370-MS01": 28, "5380-S03": 28, "5380-S02": 28, "1212-P-MS02": 28, "1212-P-MS03": 28, "1212-P-MS01": 28, "81211-P-S01": 28, "81211-P-MS03": 28, "81211-P-S03": 28, "81211-P-S02": 28, "81214-P-M04": 28, "81214-P-M05": 28, "81214-P-M06": 28, "81214-P-M07": 28, "81214-P-M27": 28, "81214-P-M30": 28, "81214-P-M36": 28, "81214-P-M38": 28, "81214-P-M40": 28, "81214-P-GB": 28, "81214-P-M77": 28, "81214-P-M78": 28, "1212-C-MS02": 28, "1212-C-MS03": 28, "1212-C-MS01": 28, "1218-C-M09": 28, "81211-C-S01": 28, "81211-C-MS03": 28, "81211-C-M09": 28, "81211-C-S02": 28, "81211-C-S03": 28, "81214-C-M07": 28, "81214-C-M27": 28, "81214-C-M36": 28, "81214-C-M40": 28, "81214-C-GB": 28, "81214-C-M49": 28, "81214-C-M78": 28, "LUX-MPB-13": 28, "MPB-M07": 28, "LUX-MPB-14": 28, "MPB-M08": 28, "LUX-MPB-L05": 28, "MPB-B": 28, "MPB-M75": 28, "MPB-M09": 28, "LUX-MPB-106": 28, "LUX-SPB-13": 28, "SPB-M07": 28, "LUX-SPB-14": 28, "SPB-M08": 28, "LUX-SPB-L05": 28, "SPB-B": 28, "SPB-M75": 28, "SPB-M09": 28, "LUX-SPB-106": 28, "FFW-10-BK": 28, "4860-RO70N": 28, "4860-RK70": 28, "4860-RE60W": 28, "4860-32IJ": 28, "4860-24IJ": 28, "45179-ST": 28, "4820-32IJ": 28, "4820-24IJ": 28, "1644-AIR": 28, "1644-24IJ": 28, "4899-24IJ": 28, "4899-32IJ": 28, "912CWIN": 28, "4894-AIR": 28, "FFW-1013-GB": 28, "FFW-1013-B": 28, "FFW-1013-18": 28, "1117-J-GB": 28, "1117-J-B": 28, "1CO-CT": 28, "1CO-M09": 28, "1CO-NLI": 28, "1CO-WLI": 28, "10BS-BLI": 28, "10BS-06": 28, "SPW10-80PW": 28, "SPW10-80SW": 28, "SPW10W-80UW": 28, "4261-32IJ": 28, "LEVC-S01": 28, "614BB-MS02": 28, "614BB-MS01": 28, "69BS-28BK": 28, "69BS-28GK": 28, "69BS-28W": 28, "1801-CT": 28, "1801-WLI": 28, "LEEINNER-SN": 28, "LEEOUTER-SN": 28, "LEEOUTER-SBW": 28, "ROYINNER-SBW": 28, "ROYINNER-SN": 28, "ROYOUTER-SBW": 28, "ROYOUTER-SN": 28, "WININNER-SBW": 28, "WININNER-SN": 28, "WINOUTER-SN": 28, "1113PBM-BF": 28, "1113PBM-G": 28, "1113PBM-HR": 28, "69PBM-BF": 28, "69PBM-G": 28, "69PBM-HR": 28, "69PBM-MB": 28, "SBM851125": 28, "LUXMLR-BLI": 28, "LUXMLR-L20": 28, "LUXMLR-M07": 28, "LUXMLR-GB": 28, "LUXMLR-11": 28, "LUXMLR-B": 28, "LUXMLR-NLI": 28, "LUXMLR-103": 28, "LUXMLR-102": 28, "LUXMLR-M06": 28, "LUXMLR-WLI": 28, "XPJ851125": 28, "4020-S01": 28, "4020-S02": 28, "4870-RO70N": 28, "4040-S01": 28, "4040-MS01": 28, "5380-S01": 28, "1218-P-M09": 28, "1319-P-M09": 28, "81211-P-MS02": 28, "81211-P-MS01": 28, "81214-P-M22": 28, "81214-P-M49": 28, "81214-P-M50": 28, "1319-C-M09": 28, "81211-C-MS02": 28, "81214-C-M22": 28, "81214-C-M30": 28, "81214-C-M77": 28, "MPB-M89": 28, "SPB-M89": 28, "FFW-912-BK": 28, "FFW-912-GB": 28, "1CO-14T": 28, "SPW10-80UW": 28, "LEVC-S02": 28, "614BB-MS03": 28, "1801-BLI": 28, "1113PBM-MB": 28, "LUXMLR-17": 28, "LUXMLR-10": 28, "LUXMLR-22": 28, "43675-ST": 28, "10BS-NLI": 28, "LUX-1590-L22": 28, "LUX-1590-18": 28, "LUX-1590-17": 28, "LUX-1590-13": 28, "LUX-1590-12": 28, "LUX-1590-11": 28, "LUX-1590-102": 28, "LUX-1590-101": 28, "LUX-1590-07": 28, "1590-WLI": 28, "1590-GB": 28, "61112-GB": 28, "61112-70W": 28, "LUX-1590-B": 28, "LUX-1590-22": 28, "LUX-1590-L20": 28, "LUX-1590-103": 28, "5010-C-S03": 28, "5010-C-S01": 28, "5010-C-S02": 28, "834SQFLT-27": 28, "834SQFLT-15": 28, "834SQFLT-12": 28, "634SQFLT-25": 28, "634SQFLT-26": 28, "634SQFLT-23": 28, "634SQFLT-27": 28, "734SQFLT-10": 28, "734SQFLT-11": 28, "734SQFLT-12": 28, "734SQFLT-13": 28, "734SQFLT-14": 28, "734SQFLT-17": 28, "734SQFLT-15": 28, "734SQFLT-18": 28, "734SQFLT-23": 28, "734SQFLT-22": 28, "734SQFLT-25": 28, "734SQFLT-27": 28, "734SQFLT-26": 28, "EX5030-56": 28, "634SQFLT-22": 28, "434SQFLT-23": 28, "434SQFLT-26": 28, "534SQFLT-10": 28, "4040-MS08": 28, "534SQFLT-15": 28, "534SQFLT-17": 28, "LINER-MS08": 28, "EX4060-56": 28, "834SQFLT-10": 28, "834SQFLT-11": 28, "834SQFLT-FA-02": 28, "834SQFLT-FA-04": 28, "834SQFLT-WPC": 28, "534SQFLT-W": 28, "734SQFLT-WPC": 28, "534SQFLT-FA-05": 28, "534SQFLT-FA-04": 28, "634SQFLT-N": 28, "634SQFLT-W": 28, "734SQFLT-N": 28, "LUX-LINER-113": 28, "LUX-4080-113": 28, "634SQFLT-FA-02": 28, "634SQFLT-FA-04": 28, "634SQFLT-FA-05": 28, "634SQFLT-FA-07": 28, "634SQFLT-FA-06": 28, "734SQFLT-FA-01": 28, "734SQFLT-FA-02": 28, "734SQFLT-FA-04": 28, "734SQFLT-FA-05": 28, "5040-C-S03": 28, "734SQFLT-FA-06": 28, "5060-C-S01": 28, "5060-C-S02": 28, "4030-C-S01": 28, "4010-C-S03": 28, "4010-C-S02": 28, "4030-C-S02": 28, "4010-C-S01": 28, "5080-C-S01": 28, "5060-C-S03": 28, "634SQFLT-14": 28, "634SQFLT-15": 28, "634SQFLT-17": 28, "4080-C-S03": 28, "634SQFLT-18": 28, "834SQFLT-W": 28, "434SQFLT-NPC": 28, "434SQFLT-FA-02": 28, "534SQFLT-NPC": 28, "434SQFLT-FA-01": 28, "634SQFLT-NPC": 28, "434SQFLT-WPC": 28, "534SQFLT-WPC": 28, "734SQFLT-NPC": 28, "434SQFLT-FA-04": 28, "834SQFLT-NPC": 28, "4080-C-S02": 28, "434SQFLT-FA-06": 28, "434SQFLT-FA-05": 28, "434SQFLT-11": 28, "434SQFLT-13": 28, "434SQFLT-12": 28, "434SQFLT-FA-07": 28, "534SQFLT-FA-01": 28, "534SQFLT-FA-02": 28, "434SQFLT-14": 28, "4060-C-S03": 28, "4060-C-S01": 28, "4060-C-S02": 28, "4070-C-S01": 28, "434SQFLT-17": 28, "4030-C-S03": 28, "434SQFLT-15": 28, "434SQFLT-18": 28, "434SQFLT-22": 28, "434SQFLT-25": 28, "434SQFLT-N": 28, "834SQFLT-17": 28, "834SQFLT-26": 28, "834SQFLT-25": 28, "834SQFLT-23": 28, "834SQFLT-22": 28, "834SQFLT-18": 28, "5040-C-S02": 28, "5040-C-S01": 28, "834SQFLT-13": 28, "834SQFLT-14": 28, "5030-C-S01": 28, "5030-C-S03": 28, "434SQFLT-27": 28, "534SQFLT-11": 28, "534SQFLT-12": 28, "534SQFLT-13": 28, "534SQFLT-14": 28, "434SQFLT-10": 28, "534SQFLT-18": 28, "534SQFLT-23": 28, "534SQFLT-22": 28, "534SQFLT-25": 28, "534SQFLT-27": 28, "734SQFLT-FA-07": 28, "834SQFLT-FA-01": 28, "834SQFLT-FA-06": 28, "834SQFLT-FA-05": 28, "534SQFLT-FA-06": 28, "534SQFLT-FA-07": 28, "634SQFLT-WPC": 28, "634SQFLT-FA-01": 28, "5080-C-S03": 28, "5080-C-S02": 28, "834SQFLT-FA-07": 28, "634SQFLT-11": 28, "634SQFLT-10": 28, "634SQFLT-12": 28, "634SQFLT-13": 28, "834SQFLT-N": 28, "734SQFLT-W": 28, "4070-C-S03": 28, "4080-C-S01": 28, "4070-C-S02": 28, "534SQFLT-26": 28, "534SQFLT-N": 28, "MBB-PDR": 28, "MBB-PDP": 28, "MBB-CHEVR": 28, "MBB-PDB": 28, "MBB-CHEVN": 28, "MBB-PDGB": 28, "MBB-CHEVP": 28, "MBB-PDN": 28, "MBB-CHEVB": 28, "LBB-CHEVGB": 28, "LBB-CHEVN": 28, "LBB-CHEVG": 28, "LBB-CHEVR": 28, "LBB-DSGB": 28, "LBB-CHEVP": 28, "LBB-CHEVB": 28, "LBB-PDG": 28, "LBB-PDB": 28, "LBB-PDGB": 28, "LBB-PDP": 28, "LBB-W": 28, "LBB-PDR": 28, "MBB-CHEVGB": 28, "MBB-CHEVG": 28, "5030-C-S02": 28, "5020-C-S02": 28, "5020-C-S03": 28, "5020-C-S01": 28, "1319-P-S02": 28, "1117-P-S03": 28, "1212-P-S02": 28, "1319-P-S01": 28, "1218-P-MS01": 28, "1218-P-S03": 28, "1218-P-MS02": 28, "81211-P-MS08": 28, "1218-P-MS03": 28, "1218-P-S02": 28, "1319-P-S03": 28, "1212-P-S03": 28, "1319-P-MS03": 28, "1117-P-BLON": 28, "1319-P-MS01": 28, "81214-P-MS08": 28, "1117-P-CHAM": 28, "1319-P-BK24": 28, "1218-P-BK24": 28, "1212-P-BK24": 28, "81211-P-BK24": 28, "1117-P-BK24": 28, "81214-P-BK24": 28, "81214-P-S02": 28, "1319-P-BK28": 28, "81214-P-S03": 28, "1218-P-114": 28, "1117-P-S02": 28, "1218-P-BK28": 28, "1117-P-BK28": 28, "1212-P-BK28": 28, "1117-P-S01": 28, "81214-P-MS03": 28, "81211-P-114": 28, "1117-P-MS02": 28, "1212-P-S01": 28, "1218-P-MS08": 28, "1319-P-MS08": 28, "81214-P-MS02": 28, "1117-P-114": 28, "81214-P-MS01": 28, "81211-P-BK28": 28, "81214-P-BK28": 28, "81214-P-114": 28, "1117-P-MS08": 28, "1212-P-114": 28, "1319-P-114": 28, "81214-P-S01": 28, "1117-P-MS01": 28, "1218-P-S01": 28, "1117-P-MS03": 28, "1212-P-MS08": 28, "1319-P-MS02": 28, "1319-C-S02": 28, "81214-C-S03": 28, "1117-C-S02": 28, "1218-C-MS03": 28, "1117-C-S01": 28, "81214-C-S01": 28, "1218-C-S03": 28, "1117-C-BLON": 28, "1319-C-MS02": 28, "81211-C-MS08": 28, "81214-C-MS08": 28, "1319-C-MS01": 28, "1319-C-S03": 28, "1319-C-S01": 28, "1212-C-S01": 28, "81214-C-S02": 28, "81211-C-S04": 28, "81211-C-S05": 28, "81214-C-MS02": 28, "1117-C-CHAM": 28, "1319-C-MS08": 28, "1218-C-MS01": 28, "1218-C-MS02": 28, "1117-C-23": 28, "1212-C-S02": 28, "1117-C-MS08": 28, "1117-C-101": 28, "1218-C-S01": 28, "1117-C-MS01": 28, "1218-C-MS08": 28, "1117-C-S03": 28, "1212-C-S03": 28, "1117-C-M30": 28, "1117-C-MS02": 28, "1212-C-MS08": 28, "1218-C-S02": 28, "81214-C-MS01": 28, "LUX-10APW-103": 28, "24559-QP": 28, "LUX-10APW-GB": 28, "LUX-10APW-18": 28, "712W-WST": 28, "634-FDIC": 28, "10APW-BK": 28, "LUX-10APW-L22": 28, "WS-3304": 28, "10W-SAT": 28, "LUX-10APW-56": 28, "WS-5536": 28, "21438": 28, "4860-S02": 28, "WS-3145": 28, "4860-S01": 28, "14W-WST": 28, "1012RHW-W": 28, "7W-WST": 28, "634W-FDIC": 28, "15R-W": 28, "7R-BK": 28, "634W-W": 28, "7489-W2": 28, "10APW-WW": 28, "48DW-W": 28, "634W-PS": 28, "24539": 28, "10BS-28GK": 28, "24529": 28, "WS-2995": 28, "14R-WST": 28, "12R-WST": 28, "12R-03996": 28, "4860-S03": 28, "12W-WST": 28, "99406-28": 28, "734R-ST": 28, "9DW-W": 28, "LUX-4820-39": 28, "WS-5428": 28, "1015C-BK": 28, "WS-4584": 28, "WS-4976": 28, "1215C-BK": 28, "WS-4752": 28, "WS-4880": 28, "610MIB-W": 28, "69W-W": 28, "WS-5280": 28, "611MIB-W": 28, "4892-24BK": 28, "912BW-W": 28, "LUX-4899-39": 28, "WS-5568": 28, "WS-4424": 28, "FE-4220-18": 28, "LUX-1645-GB": 28, "LUX-1645-56": 28, "WS-7362": 28, "4892-28BK": 28, "1013-SAT": 28, "WS-7471": 28, "912-SAT": 28, "LUX-4875-39": 28, "LEVC-GBH04": 28, "LUXLEVC-17": 28, "4340-BK": 28, "WS-5472": 28, "1CO-M36": 28, "A7BB-MS08": 28, "4030-S02": 28, "1801-WH02": 28, "4CO-GB": 28, "4030-S01": 28, "8535-S02": 28, "LEVC-H03": 28, "LUX-7CO-18CNY": 28, "4030-S03": 28, "614BB-MS08": 28, "LUXLEVC-114": 28, "1CO-M27": 28, "LUX-4CO-18": 28, "8535-S03": 28, "8535-S01": 28, "WS-3952": 28, "1COS01": 28, "6675-17": 28, "WS-4504": 28, "1COS03": 28, "1801-S01": 28, "1801-S03": 28, "1COCRYS": 28, "WS-5560": 28, "1802-GBH01": 28, "LEVC-GBH05": 28, "1CO-M38": 28, "LUX-4CO-B": 28, "4BAR-BW": 28, "1801-S02": 28, "1880-BLI": 28, "4CO-07": 28, "4CO-06": 28, "1COQUAR": 28, "1COS02": 28, "4872-114B": 28, "LUX-4880-39": 28, "WS-7610": 28, "LUX-4895-39": 28, "LUX-8505-12": 28, "LUX-1880-103": 28, "WS-5504": 28, "WS-7614": 28, "WS-7615": 28, "LUX-4865-39": 28, "4CO-28W": 28, "LUX-4870-39": 28, "WS-7611": 28, "WS-7613": 28, "WS-7612": 28, "WS-7605": 28, "WS-7609": 28, "LUX-KGBBM-000": 28, "LUX-KGBBM-0": 28, "LUX-KNPBM-000": 28, "LUX-KGBBM-00": 28, "LUX-KGBM-000": 28, "LUX-KGBM-0": 28, "4040-C-S04": 28, "5010-C-S04": 28, "4020-C-S04": 28, "4080-C-S04": 28, "SH4872-03": 28, "LF-118-DDBLU100": 28, "LUX-4260-12": 28, "LUX-72973-12": 28, "WEL-BIEN-DDBLU100-GF": 28, "1117-C-S04": 28, "5040-C-S05": 28, "LUX-4260-103": 28, "LUX-4885-18": 28, "LUX-4260-18": 28, "5020-C-S05": 28, "4010-C-S04": 28, "SH4885-01": 28, "5030-C-S04": 28, "1212-C-S04": 28, "5060-C-S04": 28, "SH4895-03": 28, "1218-C-S04": 28, "81214-C-S04": 28, "LUX-4885-BLI": 28, "4030-C-S05": 28, "LUX-4885-11": 28, "1212-C-S05": 28, "7716-07": 28, "SH4872-01": 28, "LUX-4260-11": 28, "81211-C-SG": 28, "4060-C-S05": 28, "WEL-DDP100-GF": 28, "7716-06": 28, "LUX-72973-13": 28, "4070-C-S05": 28, "4010-M08": 28, "1319-C-S05": 28, "LUX-LINER-B": 28, "LUX-4260-101": 28, "LUX-4885-WLI": 28, "LUX-4260-22": 28, "5010-C-S05": 28, "LUX-4855-101": 28, "SH4895-01": 28, "5030-C-S05": 28, "LUX-4855-22": 28, "4060-C-S04": 28, "4885-07": 28, "10WBF-24WMI": 28, "FE4580-05-YAY": 28, "4040-C-S05": 28, "FFW-10-80W": 28, "5020-C-S04": 28, "LUX-4885-12": 28, "4010-C-S05": 28, "9DW-24W": 28, "1117-C-S05": 28, "4030-C-S04": 28, "10DW-24W": 28, "4885-04": 28, "5080-C-S04": 28, "LUX-4885-22": 28, "63DW-24W": 28, "LUX-4860-W22": 28, "10R-28W": 28, "5395-M07": 28, "5060-C-S05": 28, "5080-C-S05": 28, "49W-24WMI": 28, "LUX-4885-GB": 28, "1319-C-S04": 28, "LUX-4855-12": 28, "4885-06": 28, "10W-MST": 28, "LUX-4885-NLI": 28, "1218-C-S05": 28, "LUX-4885-39": 28, "LUX-4860-W18": 28, "5040-C-S04": 28, "EX4885-27": 28, "LUX-4885-13": 28, "A10-24WMI": 28, "1012W-24WMI": 28, "4885-M07": 28, "4872-80W": 28, "LUX-4260-B": 28, "LUX-4855-103": 28, "4080-C-S05": 28, "81214-C-S05": 28, "WEL-DDBLK100-GF": 28, "LUX-4860-W103": 28, "LUX-4885-14": 28, "4070-C-S04": 28, "A8-24WMI": 28, "SH4885-03": 28, "4020-C-S05": 28, "MF-144-DB100": 28, "49DW-24WMI": 28, "56MR-W": 28, "LF-118-DDBLK100": 28, "WEL-DB100-SF": 28, "A7FFW-BK": 28, "SF-102-DDBLU100": 28, "LUX-4880-COLORPACK": 28, "OFFICEBUNDLE-200PACK": 28, "46W": 28, "4855-GB": 28, "4260-GB": 28, "LUX-4590-101": 28, "1CO-GBSG": 28, "81211-C-HCOLORPACK": 28, "PHGC1-70WSG": 28, "4060-130W": 28, "LUX-1CO-18H": 28, "4590-M07": 28, "1CO-80WSB": 28, "LUX-4590-18": 28, "LUX-4590-GB": 28, "4590-06": 28, "81211-P-HCOLORPACK": 28, "A7FW-80WHH": 28, "81211-P-HMETALLICPACK": 28, "5370-MS08": 28, "1801-GBHE": 28, "LUX-4590-11": 28, "LUX-4590-103": 28, "4880-HCOLORPACK": 28, "4892FFW-80W": 28, "LUX-1801-18HH": 28, "LUX-4590-12": 28, "4590-07": 28, "5380-HMETALLICPACK": 28, "81211-C-HMETALLICPACK": 28, "MF-144-DE100": 28, "SF-101-CMBUR12": 28, "69BW-24WMI": 28, "MF-144-DMAH100": 28, "PF-N": 28, "SF-101-CS80": 28, "811BW-28W": 28, "84477WIN": 28, "SF-101-BN100": 28, "MF-144-SG12": 28, "SF-101-GMC": 28, "SF-101-BT80": 28, "SF-101-DMAH100": 28, "SF-101-CMBLK12": 28, "SF-101-DDBLK100": 28, "WEL-BIEN-DB100-GF": 28, "1218-P-GB": 28, "22646": 28, "8515-M09": 28, "EX10-LEBAOL28": 28, "5020-SW": 28, "66456": 28, "133FG": 28, "4166": 28, "LUX-A7PKT103": 28, "EX4894-22": 28, "73821": 28, "43430": 28, "16PG": 28, "EX4820-10": 28, "A7FW": 28, "LEVC933": 28, "LUX-4899-05": 28, "81214-C-113": 28, "95083": 28, "FFW-69": 28, "8383": 28, "A7ZF-06": 28, "LUX-KWBM-CD": 28, "EX4030-56": 28, "A1FW": 28, "LUX-4899-17": 28, "SIVV916": 28, "81211-P-M08": 28, "12286": 28, "EX5040-13": 28, "BC4010-11": 28, "8250": 28, "LUX-4899-106": 28, "LEVCGLD": 28, "EX1CO-27": 28, "94771": 28, "EX4899-18": 28, "8525-50": 28, "EX10-LEBA700PF": 28, "81214-C-11": 28, "LUX-A7PKT104": 28, "LUXA7GF-106": 28, "10350": 28, "EX10-LEBA707PF": 28, "84477": 28, "12039": 28, "AIR378-B": 28, "94961": 28, "FFW-912": 28, "4040-L05": 28, "16PB": 28, "A1FN": 28, "49420": 28, "LUX-A7PKT106": 28, "A7GF-06": 28, "4010-113": 28, "16014": 28, "EX5040-25": 28, "4875-SG": 28, "81214-C-12": 28, "4870-SBW": 28, "12252": 28, "EX4080-11": 28, "17897": 28, "8515-06": 28, "A2FW": 28, "95000": 28, "4897-WLI": 28, "EX4820-14": 28, "5380-M07": 28, "4820-GB": 28, "EX10-LEBATE24": 28, "AIR378-70W": 28, "4030-101": 28, "80428": 28, "F-8525-B": 28, "LUX-1CO-07": 28, "GLASS-03": 28, "AIR378-M06": 28, "94904": 28, "EX5040-27": 28, "7CO-M06": 28, "512CO-28GK": 28, "LUX-7CO-103": 28, "4040-MET-06": 28, "WS-0101": 28, "WS-4618": 28, "10157": 28, "LUX-1CO-23": 28, "26685": 28, "4020-L17": 28, "1820-08": 28, "GLASS-19": 28, "EX10-LEBA703PF": 28, "4875-M07": 28, "12310": 28, "4880-SBW": 28, "75829": 28, "LUX-PF-07": 28, "1319-P-80W": 28, "96740": 28, "17889": 28, "EX5010-26": 28, "98156": 28, "LUX-8515-102": 28, "92021": 28, "BC4040-B": 28, "LUXA7ZF-22": 28, "81214-C-L07": 28, "8515-M07": 28, "LUX-7CO-10": 28, "GLASS-01": 28, "EX10-LEBAQMPF": 28, "EX4894-13": 28, "4040-NPC": 28, "8525-20": 28, "1319-C-CW": 28, "EX10-LEBAWH28": 28, "96PB": 28, "8555-03": 28, "LUX-1801-18": 28, "1319-P-WCN": 28, "EX4040-56": 28, "EX10-LEBARE28": 28, "LUX-8515-101": 28, "A2CW": 28, "LUX-1CO-104": 28, "8525-12": 28, "4040-112": 28, "LUX-4820-113": 28, "LUX-4895-L05": 28, "EX10-LEBAGM28": 28, "5030-SW": 28, "LUX-5040-L22": 28, "EX10-LEBA711PF": 28, "EX4899-22": 28, "EX4030-11": 28, "57633": 28, "EX4899-11": 28, "A7ZF-WPC": 28, "5010-SN": 28, "LUX-4899-L22": 28, "390W": 28, "EX10-LEBA527PC": 28, "67781": 28, "4892-GB": 28, "FA5030-05": 28, "LUX-5040-103": 28, "17MFN": 28, "EX4020-13": 28, "EX4020-56": 28, "6025-01": 28, "A7PKTGB": 28, "FA5020-01": 28, "6075-01": 28, "8504-07": 28, "5365-M08": 28, "LUX-8525-104": 28, "160FY": 28, "81211-P-WCN": 28, "43984": 28, "EX5040-17": 28, "A1CW": 28, "EX10-LEBA705PF": 28, "81214-C-L20": 28, "75894": 28, "LUX-4820-103": 28, "75747": 28, "75746": 28, "EX4060-13": 28, "4020-102": 28, "EX4060-26": 28, "4010-104": 28, "EX5020-10": 28, "16PP": 28, "LUX-7CO-11": 28, "E4894-00": 28, "EX4080-25": 28, "95067": 28, "LUX-1CO-15": 28, "318": 28, "7CO-B": 28, "FA81211-C-02": 28, "780GF": 28, "SIVV918": 28, "12328": 28, "FFW-83411": 28, "LUX-7CO-12": 28, "LUXA7GF-104": 28, "94755": 28, "8510-70W": 28, "EN6302": 28, "FE-4220-15": 28, "17954": 28, "EX10-LEBA543PC": 28, "4899-BLI": 28, "FE-6070-15": 28, "81211-P-SG": 28, "8375": 28, "1602": 28, "7486-W2": 28, "75852": 28, "LUX-4895-L20": 28, "61538": 28, "46PG": 28, "EX10-LEBA712PF": 28, "LUX-4820-102": 28, "LEVCBLK": 28, "EX10-LEBADR23": 28, "5375-02": 28, "A6CN": 28, "16PO": 28, "EX4899-23": 28, "8503-18": 28, "A6FW": 28, "4020-103": 28, "4872-M08": 28, "94680": 28, "MINSHC": 28, "FA4010-07": 28, "4895-WPP": 28, "EX4080-14": 28, "EX10-LEBA718PF": 28, "46PP": 28, "12229": 28, "EX4020-14": 28, "5365-30": 28, "94888": 28, "BC4010-B": 28, "EX1644-14": 28, "EX5040-23": 28, "EX10-LEBAOR28": 28, "4870-SG": 28, "LUX-512CO-L22": 28, "EX10-LEBAQM28": 28, "4040-120GL": 28, "4865-SG": 28, "97767": 28, "BC4040-11": 28, "81211-C-130W": 28, "62455": 28, "EX4060-23": 28, "4820-GK": 28, "49783": 28, "EX4899-13": 28, "46FO": 28, "EX5030-17": 28, "92019": 28, "81214-C-103": 28, "EX4899-14": 28, "1590-32IJ": 28, "A6CW": 28, "EX4894-11": 28, "1820-07": 28, "4020-MET-06": 28, "EX10-LEBA537PC": 28, "81211-C-M08": 28, "EX4060-12": 28, "EX4820-13": 28, "66464": 28, "EX5020-23": 28, "WS-0406": 28, "5380-M08": 28, "26949": 28, "7450-GK": 28, "8503-B": 28, "4872-08": 28, "PGCST909": 28, "EX10-LEBA701PF": 28, "EX5030-13": 28, "4040-102": 28, "EX4030-22": 28, "EX4899-12": 28, "EX4060-15": 28, "FFW-125": 28, "LUX-512CO-12": 28, "1590PS": 28, "1801-07": 28, "EX4040-10": 28, "FA5030-06": 28, "EX5030-22": 28, "EX4020-26": 28, "LUX-1CO-106": 28, "LUX-LINER-103": 28, "EX4010-22": 28, "LUX-4894-L22": 28, "81211-P-M07": 28, "8525-80W": 28, "8504-18": 28, "1590B": 28, "4860-BLI": 28, "LUX-7CO-22": 28, "A7GF-80W": 28, "4875-M08": 28, "1CO-80W": 28, "5040-WLI": 28, "EX4060-22": 28, "EX4040-14": 28, "EX4030-26": 28, "EX4040-26": 28, "LUXA7GF-113": 28, "5030-SN": 28, "11874": 28, "FA5040-02": 28, "4030-SW": 28, "4020-101": 28, "4030-18GB": 28, "4040-M08": 28, "4162": 28, "MINSHB": 28, "8520-06": 28, "E4820-00": 28, "EX10-LEBADR24": 28, "5370-M08": 28, "4872-M07": 28, "LUX-8525-103": 28, "10910": 28, "82624": 28, "A7FN": 28, "71414": 28, "EX4010-56": 28, "4030-SN": 28, "LUX-7CO-102": 28, "EX10-LEBATE28": 28, "81211-C-M07": 28, "EX10-LEBAGMPF": 28, "7716-GK": 28, "7955": 28, "LUXA7GF-23": 28, "5360-M08": 28, "4040-113": 28, "17905": 28, "EX10-LEBASM28": 28, "EX10-LEBA704PF": 28, "GLASS-09": 28, "EX10-LEBANA28": 28, "11700": 28, "LUX-1CO-26": 28, "81214-C-104": 28, "4872-30": 28, "EX4080-15": 28, "96PG": 28, "8151": 28, "LUXA7GF-B": 28, "1820-WPC": 28, "EX10-LEBA706PF": 28, "46FY": 28, "EX10-LEBAOL24": 28, "1212-C-GB": 28, "EX4820-27": 28, "EX4080-27": 28, "48643": 28, "PGCST919": 28, "FFW-912-18": 28, "FFW-912-GK": 28, "EX5020-27": 28, "8535-80W": 28, "46PO": 28, "A6FN": 28, "INVDW": 28, "43539": 28, "A2CN": 28, "4030-MET-07": 28, "91975": 28, "FA4060-06": 28, "EX4010-14": 28, "LUX-1CO-20": 28, "ET4865-14": 28, "EX4010-11": 28, "55845": 28, "F-4220-B": 28, "BC4040-22": 28, "EX5040-14": 28, "4040-MET-08": 28, "F-8575-B": 28, "EX10-LEBA702PF": 28, "EX1644-10": 28, "LUXA7ZF-103": 28, "4040-120W": 28, "22500": 28, "28727": 28, "780CJ": 28, "PF-DBLI": 28, "5080-07": 28, "5040-SN": 28, "4020-104": 28, "4899-WLI": 28, "EX4894-10": 28, "43687": 28, "LUX-1CO-14": 28, "81214-C-10": 28, "12237": 28, "LUX-1CO-113": 28, "82064": 28, "5040-NPC": 28, "EX10-LEBACMPF": 28, "LUX-4894-106": 28, "LUX-8510-103": 28, "45146": 28, "8525-03": 28, "133PP": 28, "BC4040-06": 28, "43455": 28, "10951": 28, "CC9x12": 28, "LUX-8525-101": 28, "PC1802PL": 28, "8193": 28, "72637": 28, "72975": 28, "95125": 28, "4040-GB": 28, "4040-BLI": 28, "92031": 28, "LUX-8525-106": 28, "FA81211-C-01": 28, "7CO-M07": 28, "PGCST940": 28, "4040-M07": 28, "EX4020-18": 28, "WS-0404": 28, "LUX-4897-113": 28, "160FG": 28, "7450": 28, "EX-1820-18": 28, "4892-GK": 28, "LUX-8535-103": 28, "LUX-7CO-18": 28, "FA5020-06": 28, "160FO": 28, "4880-SG": 28, "46CJ": 28, "LUX-4899-101": 28, "EX4820-22": 28, "4010-103": 28, "LUXA7GF-25": 28, "5350-06": 28, "EX4030-27": 28, "EX4040-13": 28, "LUX-512CO-L20": 28, "8505-07": 28, "FA81211-C-06": 28, "54164": 28, "EX4894-23": 28, "LUXA7GF-18": 28, "LUX-4899-103": 28, "81214-C-102": 28, "5040-WPC": 28, "SF-101-DN12": 28, "LUX-1CO-101": 28, "43675": 28, "A7CN": 28, "43489": 28, "EX4020-11": 28, "EX4820-11": 28, "4020-L22": 28, "BC4010-102": 28, "4030-L20": 28, "4875-CLR": 28, "16139": 28, "8503-103": 28, "4040-WPC": 28, "EX4820-23": 28, "11173": 28, "8515-80W": 28, "PC1807PL": 28, "8510-07": 28, "5040-GB": 28, "4860-CLR": 28, "EX5030-14": 28, "LEVC930": 28, "FA5020-04": 28, "EX10-LEBAGMPC": 28, "8525-15": 28, "LUX-512CO-11": 28, "11858": 28, "FA4060-05": 28, "4010-MET-07": 28, "EX4894-17": 28, "LUX-4860-L22": 28, "FA4060-07": 28, "4020-113": 28, "1590BK": 28, "8525-WPC": 28, "1218-P-80W": 28, "LUX-4899-104": 28, "LUX-4897-102": 28, "61532": 28, "EX10-LEBA713PF": 28, "4010-SW": 28, "4872-06": 28, "8503-06": 28, "780W": 28, "16PY": 28, "285GF": 28, "A7CW": 28, "EX4020-27": 28, "EX10-LEBA716PF": 28, "A7GF-GB": 28, "4020-SN": 28, "94813": 28, "FE-7280-15": 28, "EX4894-18": 28, "EX10-LEBACMPC": 28, "1941": 28, "94946": 28, "EX10-LEBABL28": 28, "4020-MET-07": 28, "EX10-LEBASMPF": 28, "95026": 28, "18093": 28, "8504-B": 28, "LUX-4820-101": 28, "8510-GB": 28, "8525-GB": 28, "4040-103": 28, "85629": 28, "LEVC945": 28, "94839": 28, "EX5040-18": 28, "LEVCSIL": 28, "8515-CLR": 28, "1820-06": 28, "512CO-M08": 28, "LUX-4872-15": 28, "EX5020-18": 28, "EX10-LEBABK28": 28, "E4845-00": 28, "LUX-8535-102": 28, "BC4040-07": 28, "4030-MET-06": 28, "4899-NLI": 28, "EX4080-10": 28, "EX4899-10": 28, "95447": 28, "5360-M07": 28, "8515-07": 28, "FA5040-01": 28, "4010-SN": 28, "46PB": 28, "FE-4220-12": 28, "4030-104": 28, "FA5040-05": 28, "LUX-A7PTL103": 28, "EX5020-25": 28, "4865-SBW": 28, "LUXA7GF-103": 28, "LUX-7CO-101": 28, "FA81211-07": 28, "EX8555-14": 28, "EX8555-17": 28, "1117-P-22": 28, "1552": 28, "4040-MET-07": 28, "8505-80W": 28, "FA81211-04": 28, "EX4080-22": 28, "EX10-LEBA526PC": 28, "EX4899-15": 28, "5040-SBW": 28, "EX5040-15": 28, "EX5030-26": 28, "LUX-4860-05": 28, "EX1644-26": 28, "94714": 28, "BC4040-102": 28, "99977": 28, "LUX614ZF-13": 28, "LUXA7GF-22": 28, "5040-BLI": 28, "EX4820-18": 28, "5365-M07": 28, "LUX-8525-102": 28, "4892-B": 28, "8525-NPC": 28, "EX4080-13": 28, "FA4020-05": 28, "14554": 28, "8505-06": 28, "18002": 28, "EX4820-12": 28, "7CO-GB": 28, "8504-06": 28, "EX10-LEBA541PC": 28, "LUX-4899-L20": 28, "285CJ": 28, "BC4010-18": 28, "LUX-5040-104": 28, "LUX-A7PTL104": 28, "8510-NLI": 28, "A7GF-BLI": 28, "4030-103": 28, "A2FN": 28, "LUX-LINER-13": 28, "GLASS-27": 28, "8525-SN": 28, "4030-L05": 28, "LUX-6PKT104": 28, "F-6075-B": 28, "8510-01": 28, "160FP": 28, "5370-M07": 28, "EX4060-10": 28, "EX4080-18": 28, "LUX-4872-L05": 28, "4894-GB": 28, "LUX-4860-L17": 28, "4040-MET-30": 28, "EX4020-12": 28, "4875-SN": 28, "EX4010-27": 28, "4892-W": 28, "16CJ": 28, "LUX-4860-L20": 28, "4872-07": 28, "EX4080-26": 28, "5040-NLI": 28, "EX5040-11": 28, "LUX-4894-103": 28, "EX4040-27": 28, "LUX-434LC103": 28, "8510-WPC": 28, "R0268": 28, "75761": 28, "EX4010-13": 28, "BC4040-18": 28, "5350-07": 28, "LUX-4894-101": 28, "LUX614GF-103": 28, "EX5020-28": 28, "EX5020-12": 28, "A1CN": 28, "EX4894-14": 28, "FA5040-07": 28, "EX4899-17": 28, "EX5020-13": 28, "EX5020-15": 28, "4995-GB": 28, "28725": 28, "8503-07": 28, "8504-103": 28, "7285-01": 28, "93839": 28, "PGCST970": 28, "WS-0413": 28, "BC4010-07": 28, "1820-B": 28, "EX4060-11": 28, "BC4010-06": 28, "LUX-4894-104": 28, "EX4020-22": 28, "80770": 28, "LUX-8515-104": 28, "EX5040-22": 28, "EX10-LEBAQM6SPF": 28, "MF-144-DDBLK100-NC": 28, "WEL-10PACK": 28, "4010-BULI": 28, "SF-101-546-TANG": 28, "8193-IRS": 28, "CH91212-GB": 28, "8193-TAX": 28, "5060-BULI": 28, "5080-BULI": 28, "81214-C-114": 28, "81214-C-BULI": 28, "81211-C-BULI": 28, "81211-C-114": 28, "LUX-4860-GBB": 28, "CUR-00-70WGTY": 28, "LUX-4880-GBSG": 28, "LUX-4880-18G": 28, "CHEP-185": 28, "5040-BULI": 28, "5030-BULI": 28, "5020-BULI": 28, "5010-BULI": 28, "LUX-4860-18HH": 28, "WS-7494-TAX": 28, "WS-7484-TAX": 28, "4020-BULI": 28, "FE4580-05-DNT": 28, "4880-WPCH": 28, "4060-BULI": 28, "LUX-1880-18HH": 28, "LEVC902-GTY": 28, "LEVC-GBSG": 28, "4080-BULI": 28, "11874-IRS": 28, "FLWH4880-03SB": 28, "FLWH4880-04GT": 28, "1212-C-BULI": 28, "1319-C-114": 28, "1218-C-BULI": 28, "1117-C-114": 28, "1218-C-114": 28, "4860-80WSG": 28, "11874-TAX": 28, "1212-C-114": 28, "10PIN-24W": 28, "1880-80WMC": 28, "4040-BULI": 28, "CH91212-WLI": 28, "CH91212-WG120": 28, "MS03-28BLC": 28, "75746-TAX": 28, "7489-W2-TAX": 28, "LUX-4880-HFOILLINEDPACK": 28, "4030-BULI": 28, "4070-BULI": 28, "1801-24WMC": 28, "1117-C-BULI": 28, "EXLEVC-18H": 28, "1319-C-BULI": 28, "VRB-225": 28 };

function afterSubmit(type) {
    if (type == 'create') {
        var order;
        var recordType = nlapiGetRecordType();
        var recordId = nlapiGetRecordId();

        if (recordType == 'customer' || recordType == 'prospect' || recordType == 'lead') {
            afterCustomerSubmit(recordType, recordId);
        } else if (recordType == 'salesorder') {
            afterSalesOrderSubmit(order, recordType, recordId);
        } else if (recordType == 'invoice') {
            afterInvoiceSubmit(recordType, recordId);
        } else if (recordType == 'itemfulfillment') {
            afterFulfillmentSubmit(recordType, recordId);
        }
    }
}


/* 
            Gets bin info from SO and sends to BOS at time of fulfillement
*/
function afterFulfillmentSubmit(recordType, recordId) {
    var binData = {};
    var fulfillment = getRecord(recordType, recordId);
    if (typeof fulfillment != 'undefined' && fulfillment != null) {
        binData['orderId'] = fulfillment.getFieldValue('sonum');

        var totalFulfillments = fulfillment.getLineItemCount('item');
        if (typeof totalFulfillments != 'undefined' && totalFulfillments != null) {
            for (var i = 1; i <= totalFulfillments; i++) {
                fulfillment.selectLineItem('item', i);
                binData['orderItemSeqId'] = fulfillment.getCurrentLineItemValue('item', 'custcol_line_item_sequence');
                var invDetailSubrecord = fulfillment.viewCurrentLineItemSubrecord('item', 'inventorydetail');
                if (typeof invDetailSubrecord != 'undefined' && invDetailSubrecord != null) {
                    var totalInventoryAssignment = invDetailSubrecord.getLineItemCount('inventoryassignment');
                    if (typeof totalInventoryAssignment != 'undefined' && totalInventoryAssignment != null) {
                        for (var j = 1; j <= totalInventoryAssignment; j++) {
                            invDetailSubrecord.selectLineItem('inventoryassignment', j);
                            var binNumber = invDetailSubrecord.getCurrentLineItemValue('inventoryassignment', 'binnumber');
                            var bin = getRecord('bin', binNumber);
                            if (typeof bin != 'undefined' && bin != null) {
                                binData['name'] = bin.getFieldValue('binnumber');
                            }
                        }
                    }
                }
            }
        }

        if (typeof binData['name'] != 'undefined' && binData['name'] != null) {
            var queryString = '';
            for (var key in binData) {
                if (queryString != '') {
                    queryString += '&';
                }
                queryString += key + '=' + encodeURIComponent(binData[key]);
            }

            var bosResponse = nlapiRequestURL('https://os.bigname.com/admin/control/updateFulfillmentFromNetsuite?' + queryString, null, {
                'x-user-agent': 'NetsuiteCall'
            });
            var body = bosResponse.getBody();
            var returnedParams = {};
            if (body != null && body.lastIndexOf('{', 0) === 0) {
                returnedParams = JSON.parse(bosResponse.getBody());
                if (returnedParams.success) {
                    //
                }
            }
        }
    }
}

/*

        Send customer info to BOS after creation. 
*/

function afterCustomerSubmit(recordType, recordId) {
    var customer = getRecord(recordType, recordId);
    if (customer.getFieldValue('externalid') == '' || customer.getFieldValue('externalid') == null) {
        //var customer = nlapiLoadRecord('customer', 26618847)
        var customerData = {};
        customerData.netsuiteId = customer.getFieldValue('id');
        customerData.emailAddress = customer.getFieldValue('email');
        customerData.firstName = customer.getFieldValue('firstname');
        customerData.lastName = customer.getFieldValue('lastname');
        customerData.taxable = customer.getFieldValue('taxable');
        customerData.trade = (customer.getFieldValue('category') == '1') ? 'T' : 'F';
        customerData.nonprofit = (customer.getFieldValue('category') == '14') ? 'T' : 'F';

        var queryString = '';
        for (var key in customerData) {
            if (queryString != '') {
                queryString += '&';
            }
            queryString += key + '=' + encodeURIComponent(customerData[key]);
        }

        var bosResponse = nlapiRequestURL('https://os.bigname.com/admin/control/createCustomerFromNetsuite?' + queryString, null, {
            'x-user-agent': 'NetsuiteCall',
            'Content-Type': 'application/json'
        });
        var body = bosResponse.getBody();
        nlapiLogExecution('debug', 'body ', body);

        var returnedParams = {};
        if (body != null && body.lastIndexOf('{', 0) === 0) {
            returnedParams = JSON.parse(bosResponse.getBody());
            if (returnedParams.success) {
                addCustomerAndType(returnedParams, recordType, customer, null);
            }
        }
    }
}


/**
 *      copies invoice number (tranid) to the fulfillment item line for Staples orders. 
 */
function afterInvoiceSubmit(recordType, recordId) {
    var invoiceRec = getRecord(recordType, recordId);
    if (invoiceRec.getFieldValue('entity') == CUSTOMERS.staples || invoiceRec.getFieldValue('entity') == CUSTOMERS.officeDepot) {
        var staplesPO = invoiceRec.getFieldValue('otherrefnum');
        var fulFillments = nlapiSearchRecord('itemfulfillment', null, new nlobjSearchFilter('custbody_amazon_order_id', null, 'is', staplesPO));
        if (fulFillments != null) {
            for (i in fulFillments) {
                var fulFillment = getRecord(fulFillments[i].getRecordType(), fulFillments[i].getId());

                for (var j = 1; j <= fulFillment.getLineItemCount('item'); j++) {
                    fulFillment.setLineItemValue('item', 'custcol_invoice_number', j, invoiceRec.getFieldValue('tranid'));
                }

                nlapiSubmitRecord(fulFillment);
            }
        }
    }
}
/*
                    handles fees (DEPRECATED) - not to be used in JAM implementation. 
*/
function afterSalesOrderSubmit(order, recordType, recordId) {
    var rate = 35;
    order = getRecord(recordType, recordId);
    //get only those that are webservice orders and from staples.com
    if (order.getFieldValue('entity') == CUSTOMERS.staples || order.getFieldValue('entity') == CUSTOMERS.officeDepot) {
        var numItems = order.getLineItemCount('item');
        var shippingCost = 0;

        for (var i = 1; i < numItems * 2; i++) {
            if (i == (numItems * 2) - 1) {
                //find the item
                var ourSku = findItemSKU(order.getLineItemValue('item', 'item', i));
                if (ourSku != null && staplesRates.hasOwnProperty(ourSku)) {
                    rate = staplesRates[ourSku];
                }

                var itemAmount = order.getLineItemValue('item', 'amount', i);
                var itemShipCost = itemAmount * 0.22;
                var netStaplesCost = itemAmount - itemShipCost;
                var envCost = netStaplesCost / ((100 - rate) / 100);
                var staplesFee = (envCost * (rate / 100)) * -1;

                order.setLineItemValue('item', 'amount', i, envCost.toFixed(5));

                order.selectNewLineItem('item');
                order.setCurrentLineItemValue('item', 'item', (order.getFieldValue('entity') == CUSTOMERS.statples) ? FEES.staples : FEES.quill);
                order.setCurrentLineItemValue('item', 'quantity', 1);
                order.setCurrentLineItemValue('item', 'amount', staplesFee);
                order.commitLineItem('item');

                shippingCost = shippingCost + itemShipCost;
            } else {
                var ourSku = findItemSKU(order.getLineItemValue('item', 'item', i));
                if (ourSku != null && staplesRates.hasOwnProperty(ourSku)) {
                    rate = staplesRates[ourSku];
                }

                var itemAmount = order.getLineItemValue('item', 'amount', i);
                var itemShipCost = itemAmount * 0.22;
                var netStaplesCost = itemAmount - itemShipCost;
                var envCost = netStaplesCost / ((100 - rate) / 100);
                var staplesFee = (envCost * (rate / 100)) * -1;

                order.setLineItemValue('item', 'amount', i, envCost.toFixed(5));

                var tempI = ++i;
                order.selectLineItem('item', tempI);
                order.insertLineItem('item', tempI);
                order.selectLineItem('item', tempI);
                order.setCurrentLineItemValue('item', 'item', (order.getFieldValue('entity') == CUSTOMERS.statples) ? FEES.staples : FEES.quill);
                order.setCurrentLineItemValue('item', 'quantity', 1);
                order.setCurrentLineItemValue('item', 'amount', staplesFee);
                order.commitLineItem('item');
                shippingCost = shippingCost + itemShipCost;
            }
        }

        order.setFieldValue('shippingcost', shippingCost);
        nlapiSubmitRecord(order);
    } else if (order.getFieldValue('entity') == CUSTOMERS.officeDepot) {
        var numItems = order.getLineItemCount('item');

        for (var i = 1; i < numItems * 2; i++) {
            if (i == (numItems * 2) - 1) {
                //find the item
                var ourSku = findItemSKU(order.getLineItemValue('item', 'item', i));
                if (ourSku != null && officeDepotRates.hasOwnProperty(ourSku)) {
                    rate = officeDepotRates[ourSku];
                }

                var itemAmount = order.getLineItemValue('item', 'amount', i);
                var envCost = itemAmount / ((100 - rate) / 100);
                var officeDepotFee = (envCost * (rate / 100)) * -1;

                order.setLineItemValue('item', 'amount', i, envCost.toFixed(5));

                order.selectNewLineItem('item')
                order.setCurrentLineItemValue('item', 'item', FEES.officeDepot);
                order.setCurrentLineItemValue('item', 'quantity', 1);
                order.setCurrentLineItemValue('item', 'amount', officeDepotFee);
                order.commitLineItem('item');
            } else {
                var ourSku = findItemSKU(order.getLineItemValue('item', 'item', i));
                if (ourSku != null && officeDepotRates.hasOwnProperty(ourSku)) {
                    rate = officeDepotRates[ourSku];
                }

                var itemAmount = order.getLineItemValue('item', 'amount', i);
                var envCost = itemAmount / ((100 - rate) / 100);
                var officeDepotFee = (envCost * (rate / 100)) * -1;

                order.setLineItemValue('item', 'amount', i, envCost.toFixed(5));

                var tempI = ++i;
                order.selectLineItem('item', tempI);
                order.insertLineItem('item', tempI);
                order.selectLineItem('item', tempI);
                order.setCurrentLineItemValue('item', 'item', FEES.officeDepot);
                order.setCurrentLineItemValue('item', 'quantity', 1);
                order.setCurrentLineItemValue('item', 'amount', officeDepotFee);
                order.commitLineItem('item');
            }
        }
        nlapiSubmitRecord(order);
    } else if (order.getFieldValue('entity') == CUSTOMERS.walmart) {
        var numItems = order.getLineItemCount('item');

        for (var i = 1; i < numItems * 2; i++) {
            if (i == (numItems * 2) - 1) {
                rate = 25;

                var itemAmount = order.getLineItemValue('item', 'amount', i);
                var envCost = itemAmount / ((100 - rate) / 100);
                var walmartFee = (envCost * (rate / 100)) * -1;

                order.setLineItemValue('item', 'amount', i, envCost.toFixed(5));

                order.selectNewLineItem('item')
                order.setCurrentLineItemValue('item', 'item', FEES.walmart);
                order.setCurrentLineItemValue('item', 'quantity', 1);
                order.setCurrentLineItemValue('item', 'amount', walmartFee);
                order.commitLineItem('item');
            } else {
                rate = 25;

                var itemAmount = order.getLineItemValue('item', 'amount', i);
                var envCost = itemAmount / ((100 - rate) / 100);
                var walmartFee = (envCost * (rate / 100)) * -1;

                order.setLineItemValue('item', 'amount', i, envCost.toFixed(5));

                var tempI = ++i;
                order.selectLineItem('item', tempI);
                order.insertLineItem('item', tempI);
                order.selectLineItem('item', tempI);
                order.setCurrentLineItemValue('item', 'item', FEES.walmart);
                order.setCurrentLineItemValue('item', 'quantity', 1);
                order.setCurrentLineItemValue('item', 'amount', walmartFee);
                order.commitLineItem('item');
            }
        }
        nlapiSubmitRecord(order);
    }
}

var createItemFulfillment = function (data) {
    nlapiLogExecution('DEBUG', 'recvd JSON = ', JSON.stringify(data));
    var itemFulfillments = [];
    var itemFulfillmentId = null;
    var receiveItem = false;
    try{
        if (typeof data.orderId !== 'undefined' && data.orderId != null) {
            var order = getOrderRecord(data.orderId);

            if (typeof order != 'undefined' && order != null) {
                //check to see if there are existing fulfillments for the item
                var totalLinks = order.getLineItemCount('links');
                if (typeof totalLinks != 'undefined' && totalLinks != null) {
                    for (var i = 1; i <= totalLinks; i++) {
                        if (order.getLineItemValue('links', 'type', i) == 'Item Fulfillment') {
                            var fulfillment = getRecord('itemfulfillment', order.getLineItemValue('links', 'id', i));
                            for (var j = 1; j <= fulfillment.getLineItemCount('item'); j++) {
                                if (typeof data.lineItem != 'undefined' && fulfillment.getLineItemValue('item', 'custcol_line_item_sequence', j) == data.lineItem) {
                                    itemFulfillments.push(fulfillment);
                                }
                            }
                        }
                    }
                }

                if (itemFulfillments.length == 0) {
                    itemFulfillments.push(null);
                }

                for (var k = 0; k < itemFulfillments.length; k++) {
                    var itemFulfillment = itemFulfillments[k];
                    if (itemFulfillment == null) {
                        itemFulfillment = nlapiTransformRecord('salesOrder', order.getFieldValue('id'), 'itemfulfillment');
                    } else if (itemFulfillment != null && itemFulfillment.getFieldValue('shipstatus') == 'C') {
                        continue;
                    }

                    /*
                    * Loop through the items and remove the lines that do not match the line item we are creating a fulfillment for
                    */
                    for (var j = itemFulfillment.getLineItemCount('item'); j >= 1; j--) {
                        if (typeof data.lineItem != 'undefined' && itemFulfillment.getLineItemValue('item', 'custcol_line_item_sequence', j) != data.lineItem) {
                            itemFulfillment.setLineItemValue('item', 'itemreceive', j, 'F');
                        } else {
                            nlapiLogExecution('DEBUG', 'item ', j);                            
                            itemFulfillment.setLineItemValue('item', 'itemreceive', j, 'T');
                            if (itemFulfillment.getLineItemValue('item', 'custcolreference_po_id', j) != null) {
                                receiveItem = true;
                            }
                        }
                    }
                    itemFulfillment.setFieldValue('shipstatus', 'C');
                    if (typeof data.tranDate !== 'undefined' && data.tranDate != null) {
                        itemFulfillment.setFieldValue('trandate', data.tranDate);
                    }

                    itemFulfillmentId = nlapiSubmitRecord(itemFulfillment);
                    nlapiLogExecution('DEBUG', 'itemFulfillmentId ',itemFulfillmentId);                            
                    itemFulfillment = getRecord('itemfulfillment', itemFulfillmentId);

                    try {
                        itemFulfillment.setLineItemValue('package', 'packagetrackingnumber', 1, data.trackingNumber);
                        itemFulfillment.setLineItemValue('package', 'packageweight', 1, data.packageWeight);
                    } catch (err) {
                        nlapiLogExecution('DEBUG', 'error during packageups logic  ',JSON.stringify(err));                                                                        
                        itemFulfillment.setLineItemValue('package', 'packagetrackingnumber', 1, data.trackingNumber);
                        itemFulfillment.setLineItemValue('package', 'packageweight', 1, data.packageWeight);
                    }


                    itemFulfillmentId = nlapiSubmitRecord(itemFulfillment);
                    nlapiLogExecution('DEBUG', 'itemFulfillmentId 2nd time ',itemFulfillmentId);                                                
                    // itemFulfillment = getRecord('itemfulfillment', itemFulfillmentId);

                    itemFulfillmentId = itemFulfillment.getFieldValue('tranid');
                }
            }
        }

        var returnData = { 'itemFulfillmentId': itemFulfillmentId };
        if (receiveItem) {
            var receivedRecord = createItemReceipt(data);
            returnData.itemReceiptId = receivedRecord.itemReceiptId;
        }
        return returnData;

    } catch (err) {
        nlapiLogExecution('Error', 'Error in create data = ', JSON.stringify(data))
        nlapiLogExecution('error', 'error in createItemFulfillment function', JSON.stringify(err));
        return err; 
    }
};

var createItemReceipt = function (data) {
    var purchaseOrder = null;
    var purchaseOrderId = null;
    var itemReceipt = null;
    var itemReceiptId = null;

    purchaseOrderId = findPO({ 'purchaseOrderId': data.purchaseOrderId }).id;
    if (purchaseOrderId != null) {
        //purchaseOrder = getRecord('purchaseorder', purchaseOrderId);
        itemReceipt = nlapiTransformRecord('purchaseorder', purchaseOrderId, 'itemreceipt');
        itemReceiptId = nlapiSubmitRecord(itemReceipt);

        itemReceipt = getRecord('itemreceipt', itemReceiptId);
    }

    return { 'itemReceiptId': itemReceiptId };
};

var getPOPDF = function (data) {
    var purchaseOrder = null;
    var purchaseOrderId = null;
    var url = null;
    var base64 = null;

    purchaseOrderId = findPO({ 'purchaseOrderId': data.purchaseOrderId }).id;
    if (purchaseOrderId != null) {
        var filePDF = nlapiPrintRecord('TRANSACTION', purchaseOrderId, 'DEFAULT', null);
        if (filePDF != null) {
            url = filePDF.getURL();
            base64 = filePDF.getValue();
        }
    }

    return { 'url': url, 'base64': base64 };
};

var getPickingPDF = function (data) {
    var salesOrder = null;
    var url = null;
    var base64 = null;

    salesOrder = findOrder(data);
    if (typeof salesOrder.tranid != 'undefined') {
        var filePDF = nlapiPrintRecord('PICKINGTICKET', salesOrder.id, 'DEFAULT', null);
        if (filePDF != null) {
            url = filePDF.getURL();
            base64 = filePDF.getValue();
        }
    }

    return { 'url': url, 'base64': base64 };
};

var findOrder = function (data) {
    var order = null;
    var orderNetsuiteId = null;
    var orderCustId = null;
    var items = [];

    if (typeof data.externalId != 'undefined') {
        order = getOrderRecordByExternalId(data.externalId);
    } else if (typeof data.orderId != 'undefined') {
        order = getOrderRecord(data.orderId);
    }

    if (order != null) {
        data.orderId = order.getFieldValue('tranid');
        orderNetsuiteId = order.getFieldValue('id');
        orderCustId = order.getFieldValue('entity');

        for (var i = 1; i <= order.getLineItemCount('item'); i++) {
            var ourSku = findItemSKU(order.getLineItemValue('item', 'item', i));
            if (order.getLineItemValue('item', 'amount', i) != null && order.getLineItemValue('item', 'amount', i) * 1 < 0) {
                continue; //we do not want service/discount items, they have "rates" so we will use that to ignore them
            }
            var itemObj = {};
            itemObj["sku"] = ourSku;
            itemObj["quantity"] = order.getLineItemValue('item', 'quantity', i);
            items.push(itemObj);
        }
    }

    return { 'orderId': data.orderId, 'tranid': data.orderId, 'id': orderNetsuiteId, 'custId': orderCustId, 'items': items };
};

/**
 * Find a PO given a PO #
 */
var findPO = function (data) {
    var po = null;
    var newData = {};

    if (typeof data.purchaseOrderId != 'undefined') {
        po = nlapiSearchRecord('purchaseorder', null, new nlobjSearchFilter('tranid', null, 'is', data.purchaseOrderId));

        if(!po) { nlapiLogExecution('EMERGENCY', 'No purchase order found. 2134 ', data.purchaseOrderId); return null; }        
        if (po.length > 1) {
            for (i in po) {
                var choice = getRecord(po[i].getRecordType(), po[i].getId());
                if (choice.getFieldValue('tranid') == data.purchaseOrderId) {
                    po = choice;
                    break;
                }
            }
        } else {
            po = getRecord(po[0].getRecordType(), po[0].getId());
        }
    } else if (typeof data.id != 'undefined') {
        po = getRecord('purchaseorder', data.id);
    }

    var items = [];
    if (po != null) {
        for (var i = 1; i <= po.getLineItemCount('item'); i++) {
            var ourSku = findItemSKU(po.getLineItemValue('item', 'item', i));
            if (po.getLineItemValue('item', 'amount', i) != null && po.getLineItemValue('item', 'amount', i) * 1 < 0) {
                continue; //we do not want service/discount items, they have "rates" so we will use that to ignore them
            }
            var itemObj = {};
            itemObj["sku"] = ourSku;
            itemObj["quantity"] = po.getLineItemValue('item', 'quantity', i);
            itemObj["name"] = (po.getLineItemValue('item', 'description', i) != null) ? po.getLineItemValue('item', 'description', i) : ourSku;
            items.push(itemObj);
        }

        newData.id = po.getId();
        newData.purchaseOrderId = po.getId();
        newData.purchaseorder = po.getFieldValue('tranid');
        newData.items = items;
    } else {
        newData.id = null;
        newData.purchaseOrderId = null;
        newData.purchaseorder = null;
        newData.items = null;
    }

    return newData;
};

/**
 * Find a PO given a order and line item
 */
var getOrderItemPO = function (data) {
    var order = getOrderRecord(data.orderId);
    if (!order) { nlapiLogExecution('EMERGENCY', 'No order found. ', data.orderId); return null; }
    
    var po = {};

    var items = [];
    for (var i = 1; i <= order.getLineItemCount('item'); i++) {
        if (typeof data.lineItem != 'undefined' && order.getLineItemValue('item', 'custcol_line_item_sequence', i) == data.lineItem && 
            typeof order.getLineItemValue('item', 'poid', i) != 'undefined' && 
            order.getLineItemValue('item', 'poid', i) != null) {
            po = findPO({ 'id': order.getLineItemValue('item', 'poid', i) });
        } else if (typeof data.lineItem != 'undefined' && 
                order.getLineItemValue('item', 'custcol_line_item_sequence', i) == data.lineItem && 
                typeof order.getLineItemValue('item', 'custcolreference_po_id', i) != 'undefined' && 
                order.getLineItemValue('item', 'custcolreference_po_id', i) != null) {
            po = findPO({ 'purchaseOrderId': order.getLineItemValue('item', 'custcolreference_po_id', i) });
        }
    }

    if (typeof po.purchaseorder == 'undefined' || typeof po.purchaseOrderId == 'undefined') {
        return { 'salesorder': data.orderId, 'purchaseorder': null, 'purchaseOrderId': null, 'items': null };
    }

    return { 'salesorder': data.orderId, 'purchaseorder': po.purchaseorder, 'purchaseOrderId': po.purchaseOrderId, 'items': po.items };
};

/**
 * Find Item SKU based on internal id
 */
var findItemSKU = function (internalId) {
    var item = nlapiSearchRecord('item', null, [new nlobjSearchFilter('internalid', null, 'is', internalId), new nlobjSearchFilter('isinactive', null, 'is', 'F')]);
    if (item == null) {
        return null;
    } else {
        if (item.length > 0) {
            for (i in item) {
                var choice = getRecord(item[i].getRecordType(), item[i].getId());
                if (choice.getFieldValue('id') == internalId) {
                    return choice.getFieldValue('itemid');
                }
            }
            return null;
        } else {
            return null;
        }
    }
};
/**
 * 
 * @param {numericstring} customForm - the form id from the website
 * @returns {string} newFormId - the new form id;
 */
var customFormIdSB1 = function (customForm) {
    // NOs are not used until terms is on form 
    var soForms = new Array();
    //soForms.cf102 = "136"	//	no      means terms is not on form 
    //soForms.cf103 = "137"	//	no
    soForms.cf109 = "164"	//	yes
    soForms.cf110 = "163"	//	yes
    soForms.cf139 = "135"	//	yes
    soForms.cf140 = "134"	//	yes
    soForms.cf147 = "140"	//	yes
    soForms.cf153 = "127"	//	yes
    soForms.cf155 = "139"	//	yes	
    soForms.cf161 = "141"	//	yes
    soForms.cf164 = "138"	//	yes
    //soForms.cf175 = "130"	//	no
    soForms.cf176 = "129"	//	yes	
    //soForms.cf183 = "132"	//	no
    soForms.cf184 = "131"	//	yes	
    soForms.cf187 = "129"	// 	yes 	
    cindex = "cf" + customForm;
    var newFormId = "";
    if (soForms.hasOwnProperty(cindex)) newFormId = soForms[cindex];
    return newFormId;
}

var customFormIdSB2 = function (customForm) {
    // NOs are not used until terms is on form 
    // form is blank it will use standard 
    var soForms = new Array();
    //soForms.cf102 = "136"	//	no      means terms is not on form 
    //soForms.cf103 = "137"	//	no
    soForms.cf109 = "292"	//	yes
    soForms.cf110 = "291"	//	yes
    soForms.cf139 = "225"	//	yes
    soForms.cf140 = "227"	//	yes
    soForms.cf147 = "296"	//	yes
    soForms.cf153 = "127"	//	yes
    soForms.cf155 = "294"	//	yes	
    soForms.cf161 = "295"	//	yes
    soForms.cf164 = "293"	//	yes
    soForms.cf175 = "289"	//	no
    soForms.cf176 = "289"	//	yes	
    soForms.cf183 = "290"	//	no
    soForms.cf184 = "290"	//	yes	
    soForms.cf187 = "289"	// 	yes 	
    cindex = "cf" + customForm;
    var newFormId = "";
    if (soForms.hasOwnProperty(cindex)) newFormId = soForms[cindex];
    //  newFormId = "";           //TODO: REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK 
    return newFormId;
}

var customFormId = function (customForm) {
    // NOs are not used until terms is on form 
    // form is blank it will use standard 
    var soForms = new Array();
    //soForms.cf102 = "136"	//	no      means terms is not on form 
    //soForms.cf103 = "137"	//	no
    soForms.cf109 = "289"	//	yes
    soForms.cf110 = "288"	//	yes
    soForms.cf139 = "302"	//	yes
    soForms.cf140 = "301"	//	yes
    soForms.cf147 = "68"	//	yes
    soForms.cf153 = "68"	//	yes
    soForms.cf155 = "68"	//	yes	
    soForms.cf161 = "68"	//	yes
    soForms.cf164 = "68"	//	yes
    soForms.cf175 = "286"	//	no
    soForms.cf176 = "286"	//	yes	
    soForms.cf183 = "287"	//	no
    soForms.cf184 = "287"	//	yes	
    soForms.cf187 = "286"	// 	yes 	
    soForms.cf192 = "296"	// 	yes 	        
    cindex = "cf" + customForm;
    var newFormId = "";
    if (soForms.hasOwnProperty(cindex)) newFormId = soForms[cindex];
    //  newFormId = "";           //TODO: REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK  REMOVE THIS HACK 
    return newFormId;
}

var shippingMethodIdSB1 = function (shippingMethodId) {
    var shippingMethods = new Array();
    shippingMethods.sm4     = "29585";         // FedEx International Ground
    shippingMethods.sm92352 = "29584";         // FedEx International Ground
    shippingMethods.sm92349 = "29579";         // FedEx International Priority
    shippingMethods.sm1972 =  "29672";         // USPS First Class (BNC)
    shippingMethods.sm92346 = "29582";          // FedEx Ground (BNC)
    shippingMethods.sm92347 = "29583";         // FedEx Home Delivery (BNC)
    shippingMethods.sm92341 = "29575";         // FedEx Standard Overnight (BNC)
    shippingMethods.sm92338 = "29574";         // FedEx Priority Overnight (BNC)
    shippingMethods.sm17464 = "434711";         // USPS Small Flat Rate
    shippingMethods.sm93516 = "434712";         // FedEx SmartPost
    shippingMethods.sm92345 = "29578";         // FedEx Express Saver (BNC)
    shippingMethods.sm92344 = "29577";         // FedEx 2Day (BNC)
    shippingMethods.sm1341 =  "29671";          // USPS Priority Mail (BNC)
    shippingMethods.sm58212 = "29595";         // UPS SurePost
    shippingMethods.sm6 =     "29617";         //UPS Second-Day Air
    shippingMethods.sm7 =   "29588";           // UPS Next-Day Air
    cindex = "sm" + shippingMethodId;
    var newShippingMethodId = "";
    if (shippingMethods.hasOwnProperty(cindex)) newShippingMethodId = shippingMethods[cindex];
    return newShippingMethodId;
}

var shippingMethodIdSB2 = function (shippingMethodId) {
    var shippingMethods = new Array();
    shippingMethods.sm4     = "429195";          // FedEx International Ground
    shippingMethods.sm92352 = "390665";          // FedEx International Ground
    shippingMethods.sm92349 = "390666";          // FedEx International Priority
    shippingMethods.sm1972 = "429215";          // USPS First Class (BNC)
    shippingMethods.sm92346 = "429155";         // FedEx Ground (BNC)
    shippingMethods.sm92347 = "429157";         // FedEx Home Delivery (BNC)
    shippingMethods.sm92341 = "429164";         // FedEx Standard Overnight (BNC)
    shippingMethods.sm92338 = "429162";         // FedEx Priority Overnight (BNC)
    shippingMethods.sm17464 = "429226";         // USPS Small Flat Rate
    shippingMethods.sm93516 = "429163";         // FedEx SmartPost
    shippingMethods.sm92345 = "429136";         // FedEx Express Saver (BNC)
    shippingMethods.sm92344 = "429151";         // FedEx 2Day (BNC)
    shippingMethods.sm1341 = "429220";         // USPS Priority Mail (BNC)
    shippingMethods.sm58212 = "429207";         // UPS SurePost
    cindex = "sm" + shippingMethodId;
    var newShippingMethodId = "";
    if (shippingMethods.hasOwnProperty(cindex)) newShippingMethodId = shippingMethods[cindex];
    return newShippingMethodId;
}
var shippingMethodId = function (shippingMethodId) {
    var shippingMethods = new Array();
    shippingMethods.sm4     = "29585";         // FedEx International Ground
    shippingMethods.sm92352 = "29584";         // FedEx International Ground
    shippingMethods.sm92349 = "29579";         // FedEx International Priority
    shippingMethods.sm1972 =  "29672";         // USPS First Class (BNC)
    shippingMethods.sm92346 = "29582";          // FedEx Ground (BNC)
    shippingMethods.sm92347 = "29583";         // FedEx Home Delivery (BNC)
    shippingMethods.sm92341 = "29575";         // FedEx Standard Overnight (BNC)
    shippingMethods.sm92338 = "29574";         // FedEx Priority Overnight (BNC)
    shippingMethods.sm17464 = "438625";         // USPS Small Flat Rate
    shippingMethods.sm93516 = "438626";         // FedEx SmartPost
    shippingMethods.sm92345 = "29578";         // FedEx Express Saver (BNC)
    shippingMethods.sm92344 = "29577";         // FedEx 2Day (BNC)
    shippingMethods.sm1341 =  "29671";          // USPS Priority Mail (BNC)
    shippingMethods.sm58212 = "29595";         // UPS SurePost
    shippingMethods.sm6 =     "29617";         //UPS Second-Day Air
    shippingMethods.sm7 =   "29588";           // UPS Next-Day Air
    cindex = "sm" + shippingMethodId;
    var newShippingMethodId = "";    
    if (shippingMethods.hasOwnProperty(cindex)) newShippingMethodId = shippingMethods[cindex];
    return newShippingMethodId;
}

var paymentMethodId  = function(oldPaymentMethodId){
    var paymentMethods = new Array();

    paymentMethods.pm11 =   "10";         // Amazon
    paymentMethods.pm18 =   "11";         // American Express Braintree
    paymentMethods.pm15 =   "12";         // Discover Braintree
    paymentMethods.pm16 =   "14";         // JCB Braintree
    paymentMethods.pm17 =   "15";         // Master Card Braintree
    paymentMethods.pm10 =   "16";         // No Payment Required
    paymentMethods.pm9 =    "17";         // Paypal
    paymentMethods.pm8 =    "18";         // PrePaid Credit Cards
    paymentMethods.pm14=    "19";         // Visa Braintree
    paymentMethods.pm12=    "20";         // iparcel
    cindex = "pm" + oldPaymentMethodId;
    var newPaymentMethodId = "";    
    if (paymentMethods.hasOwnProperty(cindex)) newPaymentMethodId = paymentMethods[cindex];
    return newPaymentMethodId;
}