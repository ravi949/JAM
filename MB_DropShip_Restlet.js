/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       08 May 2017     Mibar   NEW3
 *
 */


/**
 * @param {Object} dataIn Parameter object
 * @returns {Object} Output object
 */

const invAdjGL_parent_child = '595';
const invAdjGL_prior_day = '664';
const invAdjForm = "122";
//const SHIPACCOUNTID = "335";
const invoiceForm = "106";
const dropship_bin = '2907';
//const defaultCustomer = '28';
const intra_Transfer_from_loc_new = '13'; //InternalId of 227-Union
//const default_shipping_method = '13532'; //this has to be per subsidiary and must be setup by Janmaijay.
//const discountPerInvoice = '29677'; // '13533';
const discountOnProduct = '130637'; // added July 13th 2020;
const restLet_Email = 'cheryl@jampaper.com';

function getRESTlet(dataIn) {
    //nlapiLogExecution("debug", "Restlet check (getRESTlet)", JSON.stringify(dataIn));
    if (dataIn.recordtype == "inventoryitem") {
        return getInventory(dataIn);
    }
}

/**
 * @param {Object} dataIn Parameter object
 * @returns {Object} Output object
*/

function postRESTlet(dataIn) {
    nlapiLogExecution("debug", "Restlet check(postRESTlet)", JSON.stringify(dataIn));
    var result = new Object();
    var columns = new Object();
    try {
        if (dataIn != null && dataIn != "") {
            var recordType = dataIn['recordtype'];
            //nlapiLogExecution("debug", "Restlet check : recordType is ", recordType);

            switch (recordType) {
                case 'dropship':
                    results = buildDropShip(dataIn);
                    break;
                case 'invoice':
                    //nlapiLogExecution("debug", "Restlet check-recordType - Entering invoice ", recordType + " this is recordType  " + dataIn['invNumber']);
                    results = buildInvoice(dataIn);
                    nlapiLogExecution("debug", "Restlet results processed for buildInvoice is ", JSON.stringify(results));
                    break;
                case 'intra':
                    results = buildDomesticTransfer(dataIn);
                    nlapiLogExecution("debug", "Restlet results processed for intra is ", JSON.stringify(results));
                    break;
                case 'inter':
                    results = buildInterTransfer(dataIn);
                    nlapiLogExecution("debug", "Restlet results processed for inter is ", JSON.stringify(results));
                    break;
                case 'invadj_golive':
                    results = buildInvAdjust(dataIn);
                    nlapiLogExecution("debug", "Restlet results processed for invadj_golive is ", JSON.stringify(results));
                    break;
                case 'invadj':
                    results = buildInvAdjust(dataIn);
                    nlapiLogExecution("debug", "Restlet results processed for invadj is ", JSON.stringify(results));
                    break;
                case 'bin_sync':
                    //nlapiLogExecution("debug", "Entered here : bin_sync ", recordType);
                    results = syncBins(dataIn);
                    break;

                //default:
                //	results = "recordtype is inCorrect. Record not processed for "+ dataIn['invNumber'];
                //	nlapiLogExecution("debug", "Restlet check-recordType ", recordType + " recordtype is inCorrect. Record not processed for  "+ dataIn['invNumber']);
            }

            // var results = [ result ];
            //nlapiLogExecution("debug", "New : Restlet results processed is ", JSON.stringify(results));
            return (results);
        }
    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "post Restlet Error", ex);
        return errObject(errMsg);
    }
}

function initRes(recordType) {
    try {
        var result = new Object();
        result.recordtype = recordType;
        result.columns = new Object();
        result.id = "";
        result.error = "";
        return result;
    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "initRes Error", ex);
        return errObject(errMsg);
    }
}

function syncBins(dataIn) {
    try {
        //nlapiLogExecution("debug", "syncBins ", dataIn['items'].length);
        var recordType = dataIn['recordtype'];
        //var itemCount = dataIn['items'];
        var results = new Array();
        var result = initRes(recordType);
        var binSubList = "binnumber";
        var isPreferred = 'F';
        var isLocationFBA = 'F'

        for (var itemCnt = 0; itemCnt < dataIn['items'].length; itemCnt++) {
            var itemLine = dataIn['items'][itemCnt];
            var item = itemLine['item'];
            var item_location = itemLine['item_location'];
            var binNr = itemLine['binNr'];
            isPreferred = 'F';
            isLocationFBA = 'F'

            if (item_location == "21" || item_location == "36" || item_location == "16"
                || item_location == "17" || item_location == "18" || item_location == "19"
                || item_location == "20") {
                isPreferred = 'T';
                isLocationFBA = 'T';
            }
            nlapiLogExecution("debug", "item_location and isPreferred  ", isPreferred + '##' + item_location + '##' + itemLine + '##' + binNr);

            var rcdItem = nlapiLoadRecord("inventoryitem", item);
            //Note this is NOT performance friendly and recommened for few items. Spin CSV here and fire CSV import for large items.
            try {

                if (rcdItem != null) {
                    var binItemCount = rcdItem.getLineItemCount(binSubList);
                    if (isLocationFBA == 'T') {
                        for (var i = 1; i <= binItemCount; i++) {
                            var binlist_location = rcdItem.getLineItemValue(binSubList, 'location', i);
                            if (binlist_location == item_location) {
                                rcdItem.removeLineItem(binSubList, i);
                                break;
                            }
                        }
                    }
                    rcdItem.selectNewLineItem(binSubList);
                    rcdItem.setCurrentLineItemValue(binSubList, 'preferredbin', isPreferred == 'T' ? 'T' : 'F'); //If variable or T/F, then control it in SQL table.
                    rcdItem.setCurrentLineItemValue(binSubList, 'location', item_location);

                    rcdItem.setCurrentLineItemValue(binSubList, 'binnumber', binNr);
                    rcdItem.commitLineItem(binSubList);
                    nlapiSubmitRecord(rcdItem, false);
                    nlapiLogExecution("debug", "syncBins for item internalID : " + item, " is completed for bin " + binNr);
                    result.id = "InternalID of item record Id with syncBin completed is : " + item;
                    result.error = "";
                    results.push(result);
                    result = initRes(recordType);
                }
            }
            catch (ex) {
                var errMsg = errText(ex);
                nlapiLogExecution("error", "syncBins :ItemBin update Error for itemInternalID : " + item, ex);
                result.error = "syncBins :ItemBin update Error for itemInternalID : " + item + "\n" + errMsg;
                results.push(result);
                result = initRes(recordType);
            }
        }

    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "syncBins  - post Restlet Error", ex);
        result.error = "syncBins - post Restlet Error\n" + errMsg;
        results.push(result);
        result = initRes(recordType);
    }
    return (results);
}


function buildInterTransfer(dataIn) {
    try {
        var recordType = dataIn['recordtype'];
        var itemCount = dataIn['items'];
        var interItems_count = dataIn['items'].length;
        var inter_batchID = dataIn['batch_id'];
        var inter_batchDate = dataIn['txn_date'];

        var results = new Array();
        var result = initRes(recordType);

        var recObj_inter_invtransfer = '';
        var recId_inter = '';

        var itemLine = '';
        var item_price = 0;
        var item_transfer_price = 0;
        var itmCostAsTransferCost = 'F';

        nlapiLogExecution('debug', 'entered script-01.4', 'batchId is ' + dataIn['batch_id'] + '##' + dataIn['ns_subsidiary']);

        if (dataIn['ns_subsidiary'] == '21') //Hudson Canada has no markup. Add any such conditions here.
            itmCostAsTransferCost = 'T';

        recObj_inter_invtransfer = nlapiCreateRecord('intercompanytransferorder'); //,true);		

        recObj_inter_invtransfer.setFieldValue('orderstatus', 'B'); //to pending fulfilment
        recObj_inter_invtransfer.setFieldValue('subsidiary', dataIn["ns_from_subsidiary"]);
        recObj_inter_invtransfer.setFieldValue('tosubsidiary', dataIn['ns_subsidiary']);
        recObj_inter_invtransfer.setFieldValue('location', dataIn['ns_item_from_location']);
        recObj_inter_invtransfer.setFieldValue('transferlocation', dataIn['ns_location']);
        recObj_inter_invtransfer.setFieldValue('incoterm', '1'); //DAP
        recObj_inter_invtransfer.setFieldValue('trandate', inter_batchDate);
        recObj_inter_invtransfer.setFieldValue('tranid', inter_batchID);

        recObj_inter_invtransfer.setFieldValue('useitemcostastransfercost', itmCostAsTransferCost); //'T' //used T for Sep 14th
        recObj_inter_invtransfer.setFieldValue('memo', inter_batchID + " and CustomerID is " + dataIn['shipworks_CustomerID'] +
            " and Total items : " + interItems_count);

        for (var itemCnt = 0; itemCnt < dataIn['items'].length; itemCnt++) {
            try {

                itemLine = dataIn['items'][itemCnt];
                if (itemLine['item'] != '') {
                    item_price = parseFloatOrZero(itemLine['unitprice']);
                    item_transfer_price = parseFloatOrZero(itemLine['transfer_price']);

                    if ((item_transfer_price != item_price)) {
                        nlapiLogExecution('debug', 'item_price <> item_transfer_price', item_transfer_price + '@@' + item_price);
                        item_price = item_transfer_price;
                    }
                    //nlapiLogExecution('debug', 'item_price <> item_transfer_price',  item_transfer_price+ '@@'+item_price);

                    nlapiLogExecution('debug', 'Item Line details : ', itemCnt + '@@' + itemLine['item'] + '@@' + item_price
                        + '@@' + itemLine['quantityField'] + '@@' + itemLine['item_kit_info'] + '@@' + itemLine['item_binPickedUp']);
                    recObj_inter_invtransfer.selectNewLineItem('item');
                    recObj_inter_invtransfer.setCurrentLineItemValue('item', 'item', itemLine['item']);
                    recObj_inter_invtransfer.setCurrentLineItemValue('item', 'rate', item_price);
                    recObj_inter_invtransfer.setCurrentLineItemValue('item', 'quantity', itemLine['quantityField']);
                    recObj_inter_invtransfer.setCurrentLineItemValue('item', 'quantitycommitted', itemLine['quantityField']);
                    recObj_inter_invtransfer.setCurrentLineItemValue('item', 'custcol_mb_kit_information', itemLine['item_kit_info']);
                    recObj_inter_invtransfer.setCurrentLineItemValue('item', 'custcol_mb_bin_information', itemLine['item_binPickedUp']);
                    //recObj_inter_invtransfer.setCurrentLineItemValue('item','commitinventory', 'T');

                    recObj_inter_invtransfer.commitLineItem('item');
                }
            }
            catch (ex) {
                var errMsg = errText(ex);
                nlapiLogExecution("error", "buildInterTransfer  - lineItems ", ex);
                result.error = "buildInterTransfer - post Restlet Error\n" + errMsg;
                results.push(result);
                result = initRes(recordType);
                //continue;
            }
            //			
        }
        nlapiLogExecution('debug', 'ABOUT TO SUBMIT INTER', '');
        recId_inter = nlapiSubmitRecord(recObj_inter_invtransfer, true, true);

        if (recId_inter) {
            nlapiLogExecution('debug', 'About to start item Fulfilment transform', '');

            try {
                var ifRec = nlapiTransformRecord('intercompanytransferorder', recId_inter, 'itemfulfillment');
                ifRec.setFieldValue('shipstatus', 'C'); //shipped
                ifRec.setFieldValue('trandate', inter_batchDate);
                ifRec.setFieldValue('memo', inter_batchID + ' (Total items : ' + interItems_count + ')');
                //Before submitting, it is recommended to read through each line from transfer order, grab the 
                // shipworks_order_number and then update on item fulfilment. Currently item_fulfilment lines
                // do not have shipworks order number. Same needs to be done for item receipt.
                var ifID = nlapiSubmitRecord(ifRec);

                nlapiLogExecution('debug', 'About to start item receipt', '');

                try {
                    var irRec = nlapiTransformRecord('intercompanytransferorder', recId_inter, 'itemreceipt');
                    irRec.setFieldValue('trandate', inter_batchDate);
                    irRec.setFieldValue('memo', inter_batchID + ' (Total items : ' + interItems_count + ')');
                    var irID = nlapiSubmitRecord(irRec);
                    nlapiLogExecution('debug', 'Completed item receipt', '');
                }
                catch (ex) {
                    var errMsg = errText(ex);
                    nlapiLogExecution("error", "buildInterTransfer  - ItemReceipt", ex);
                    result.error = "buildInterTransfer - ItemReceipt\n" + errMsg;
                    results.push(result);
                    result = initRes(recordType);
                    //continue;
                }
            }
            catch (ex) {
                var errMsg = errText(ex);
                nlapiLogExecution("error", "buildInterTransfer  - ItemFulfilment", ex);
                result.error = "buildInterTransfer - ItemFulfilment\n" + errMsg;
                results.push(result);
                result = initRes(recordType);
                //continue;
            }
            result.id = "Fulfil/Receipt completed. InternalID of INTER transfer record is  : " + recId_inter;
            result.error = "";
            results.push(result);
            result = initRes(recordType);
        }
        //incoterm		

    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "buildInterTransfer  - post Restlet Error", ex);
        result.error = "buildInterTransfer - post Restlet Error\n" + errMsg;
        results.push(result);
        result = initRes(recordType);
    }
    return (results);

}
function buildDomesticTransfer(dataIn) {
    // Questions/TBD : What if there are 3 items in transfer and 2 of them have sufficient qty in 227 location but other one doesn't not. 
    // In that we can't set more than one from_location. To handle this, we need to create separate transfers for each from_location.
    // Issues : Currently inventory detail for bins has 1 from_bin and 1 to_bin. What if there are 2 bins for 227 that cumulatively becomes more than qty-to-be-transferred. 
    // This can be handled by creating array of bins and setting the inventroy-adjustment. 
    // The above issue is not done as each item will be 1 bin per location.
    try {
        var recordType = dataIn['recordtype'];
        var itemCount = dataIn['items'];
        var results = new Array();
        var result = initRes(recordType);
        var bSwitchFromLocation = "1";

        var recObj_intra_invtransfer = '';

        recObj_intra_invtransfer = nlapiCreateRecord('inventorytransfer');
        recObj_intra_invtransfer.setFieldValue('memo', "Intra-TransferNr : " + dataIn['invNumber'] + " and CustomerID is " + dataIn['shipworks_CustomerID'] + " and StoreID is " + dataIn['storeID']);

        //incoterm		
        recObj_intra_invtransfer.setFieldValue('trandate', dataIn['txn_date']);
        recObj_intra_invtransfer.setFieldValue('tranid', dataIn['invNumber']);

        recObj_intra_invtransfer.setFieldValue('location', dataIn['ns_item_from_location']);
        recObj_intra_invtransfer.setFieldValue('transferlocation', dataIn['ns_location']); //ToLocation
        recObj_intra_invtransfer.setFieldValue('subsidiary', dataIn['ns_subsidiary']);

        //recObj_intra_invtransfer.setFieldValue('status','TrnfrOrd:F');

        //nlapiLogExecution("debug", "Restlet 2nd check-items length", dataIn['items'].length); // + '--' + dataIn['items'].[1].['quantity']);

        var itemLine = '';
        var binQtyAvail = 0;
        var fromBin = "";
        var fromBin_Proposed = "";
        var toBin = "";
        var binQOH_From = 0;
        var binQOH_From_Proposed = 0;
        var binQOH_To = 0;
        var binCount_From = 0;
        var binCount_From_Proposed = 0;
        var binCount_To = 0;

        var locationOnRecord = 0;
        for (var itemCnt = 0; itemCnt < dataIn['items'].length; itemCnt++) {
            itemLine = dataIn['items'][itemCnt];
            //nlapiLogExecution("debug", "Restlet item at index " + itemCnt, itemLine['item'] + '--' + itemLine['quantityField']);

            searchResultsBin = getBinQty(itemLine['item'], intra_Transfer_from_loc_new);

            fromBin = "";
            fromBin_Proposed = "";
            toBin = "";
            binQOH_From = 0;
            binQOH_From_Proposed = 0;
            binQOH_To = 0;
            binCount_From = 0;
            binCount_From_Proposed = 0;
            binCount_To = 0;

            if (searchResultsBin) {
                for (var i = searchResultsBin.length; i > 0; i--) {
                    var cols = searchResultsBin[i - 1].getAllColumns();
                    binQOH = searchResultsBin[i - 1].getValue(cols[1]);
                    binLoc = searchResultsBin[i - 1].getValue(cols[2]);
                    binNumber = searchResultsBin[i - 1].getValue(cols[3]); //last column
                    if (parseFloat(binQOH) >= parseFloat(itemLine['quantityField'])) {
                        if (binLoc == intra_Transfer_from_loc_new) {
                            fromBin_Proposed = binNumber;
                            binQOH_From_Proposed = binQOH;
                            binCount_From_Proposed += 1;
                        }
                        if (binLoc == dataIn['ns_item_from_location']) //actual From Location
                        {
                            fromBin = binNumber;
                            binQOH_From = binQOH;
                            binCount_From += 1;
                        }
                    }
                    if (binLoc == dataIn['ns_location']) {
                        toBin = binNumber;
                        binQOH_To = binQOH;
                        binCount_To += 1;

                    }
                    nlapiLogExecution("debug", "bin item info  " + i, binQOH + '--' + binLoc + '--' + binNumber + '--' + fromBin_Proposed + '--' + fromBin + ' --' + toBin + '--' + binQOH_From_Proposed + '--' + binQOH_From + '--' + binQOH_To);
                }
                //added Apr 10,2019
                if (toBin == "") {
                    if (dataIn['ns_location'] == "21")
                        toBin = "2813" //FBAUSA;
                }
                //

                //if (binCount_From > 1 || binCount_From_Proposed > 1 || binCount_To > 1) {
                //nlapiLogExecution("debug", " More than one bin found.. Investigate  (binCount_From ,binCount_From_Proposed , binCount_To) ", binCount_From + '--' + binCount_From_Proposed + '--' + binCount_To);
                //}
                if (parseFloat(binQOH_From_Proposed) >= parseFloat(itemLine['quantityField'])) {
                    fromBin = fromBin_Proposed;
                    binQOH_From = binQOH_From_Proposed;
                    recObj_intra_invtransfer.setFieldValue('location', intra_Transfer_from_loc_new);

                    if (locationOnRecord != 0 && locationOnRecord != intra_Transfer_from_loc_new) //means we have multiple locations on this transaction. Either abort or create multiple transactions.
                    {
                        nlapiLogExecution("debug", " Step 1 : Multiple locations found. Location and proposed locations are ", locationOnRecord + '--' + intra_Transfer_from_loc_new);
                    }
                    locationOnRecord = intra_Transfer_from_loc_new;

                    //bSwitchFromLocation="0";
                    nlapiLogExecution("debug", " Location override : itemLine['quantityField'] and  binQtyAvail ", intra_Transfer_from_loc_new + '--' + fromBin + '--' + binQOH_From + '--' + itemLine['quantityField']);

                }
                else {

                    //nlapiLogExecution("debug", " Location override did not happen : itemLine['quantityField'] and  binQtyAvail ", intra_Transfer_from_loc_new + '--' + fromBin 
                    //+ '--' + binQOH_From + '--' + itemLine['quantityField']);

                    if (locationOnRecord != 0 && locationOnRecord != dataIn['ns_item_from_location']) //means we have multiple locations on this transaction. Either abort or create multiple transactions.
                    {
                        //nlapiLogExecution("debug", " Step 2 : Multiple locations found. Location and Actual From locations are ", locationOnRecord + '--' + dataIn['ns_item_from_location']);
                    }
                    locationOnRecord = dataIn['ns_item_from_location'];
                }
            }

            //if (intra_Transfer_from_loc_new ==dataIn['ns_item_from_location'])
            //{
            //	bSwitchFromLocation="0";
            //}
            //else
            //{
            //	//binQtyAvail = getBinQty(itemLine['item'],intra_Transfer_from_loc_new);

            //	binQtyAvail = getBinQty(itemLine['item'],intra_Transfer_from_loc_new);
            //	if (binQtyAvail <itemLine['quantityField']) 
            //	{
            //		bSwitchFromLocation="0";
            //		nlapiLogExecution("debug", " itemLine['quantityField'] and  binQtyAvail ", itemLine['quantityField'] + '--'+binQtyAvail );
            //	}
            //}

            //nlapiLogExecution("debug", "bin item info  (before committ) " + i, fromBin_Proposed + '--' + fromBin + ' --' + toBin + '--' + 
            //binQOH_From_Proposed + '--' + binQOH_From + '--' + binQOH_To + '--' + itemLine['quantityField']);

            recObj_intra_invtransfer.selectNewLineItem('inventory');  //item

            recObj_intra_invtransfer.setCurrentLineItemValue('inventory', 'item', itemLine['item']);
            recObj_intra_invtransfer.setCurrentLineItemValue('inventory', 'adjustqtyby', itemLine['quantityField']); //quantity
            //recObj_intra_invtransfer.setCurrentLineItemValue('inventory', 'rate',itemLine['unitprice']);	
            //recObj_intra_invtransfer.setCurrentLineItemValue('inventory', 'amount',itemLine['lineamount']);
            //recObj_intra_invtransfer.setCurrentLineItemValue('inventory', 'description',itemLine['item_description']);
            //recObj_intra_invtransfer.setCurrentLineItemValue('inventory', 'taxcode',itemLine['item_taxcode']); //'11'

            var x = recObj_intra_invtransfer.createCurrentLineItemSubrecord('inventory', 'inventorydetail'); // --> Subrecord
            x.selectNewLineItem('inventoryassignment'); // --> Sublist of Subrecord
            x.setCurrentLineItemValue('inventoryassignment', 'binnumber', fromBin); //'2509'
            x.setCurrentLineItemValue('inventoryassignment', 'tobinnumber', toBin); // internal ID  "To Bins"
            x.setCurrentLineItemValue('inventoryassignment', 'quantity', itemLine['quantityField']); // Quantity you want transferred

            x.commitLineItem('inventoryassignment'); // submit the values set in Sublist of the Subrecord
            x.commit(); // submit Subrecord			
            recObj_intra_invtransfer.commitLineItem('inventory');
        }

        //if (bSwitchFromLocation == "1")
        //{
        //	nlapiLogExecution("debug", " Location switched : bSwitchFromLocation --> ", bSwitchFromLocation);
        //	recObj_intra_invtransfer.setFieldValue('location',intra_Transfer_from_loc_new);
        //}
        //else
        //{
        //	recObj_intra_invtransfer.setFieldValue('location',dataIn['ns_item_from_location']);
        //}

        try {
            //nlapiLogExecution('audit', 'transfer record about to Committ : ', ' for ' + dataIn['invNumber']);
            var item_intra_transfr_id = nlapiSubmitRecord(recObj_intra_invtransfer, true, true);
            //nlapiLogExecution('audit', 'transfer record Id : ', ' for ' + dataIn['invNumber'] + ' is ' + item_intra_transfr_id);
            result.id = "InternalID of transfer record Id : " + item_intra_transfr_id;
            result.error = "";
            results.push(result);
            result = initRes(recordType);
        }
        catch (ex) {
            var errMsg = errText(ex);
            nlapiLogExecution("error", "Domestic transfer  Number generation failed : buildItem ", ex);
            result.error = "Domestic transfer  Number generation failed : buildItem \n" + errMsg;
            results.push(result);
            result = initRes(recordType);
            return (results);
        }
    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "buildDomesticTransfer  - post Restlet Error", ex);
        result.error = "buildDomesticTransfer - post Restlet Error\n" + errMsg;
        results.push(result);
        result = initRes(recordType);
    }
    return (results);

}


function buildInvAdjust(dataIn) {
    try {
        var recordType = dataIn['recordtype'];
        var itemCount = dataIn['items'];
        var results = new Array();
        var result = initRes(recordType);

        var a_itmAdjBin;
        var ns_itemBins;
        var adjType_factor;
        var adjType_Search;
        var itemWithQtyIncrease = 0;
        var itemWithQtyDecrease = 0;
        var invadjGL = invAdjGL_parent_child;
        var typeOfInvAdj = 'Parent_Child';
        if (dataIn['batch_id'].toLowerCase().indexOf('golive') > 0) {
            typeOfInvAdj = 'GoLive';
            invadjGL = invAdjGL_prior_day;
        }
        //nlapiLogExecution("debug", "Restlet -CreateInvAdj creating record "); //, dataIn['ns_subsidiary']);

        var record_InvAdj = nlapiCreateRecord('inventoryadjustment'); //re, {recordmode:'dynamic'});
        record_InvAdj.setFieldValue('account', invadjGL);  //internalID of the form that has custom fields (for invoice record).
        record_InvAdj.setFieldValue('customform', invAdjForm);  //internalID of the form that has custom fields (for invoice record).
        record_InvAdj.setFieldValue('subsidiary', dataIn['ns_subsidiary']); //
        record_InvAdj.setFieldValue('trandate', dataIn['txn_date']);
        record_InvAdj.setFieldValue('tranid', dataIn['batch_id']);
        //record_InvAdj.setFieldValue('class', dataIn['ns_channel']);
        //record_InvAdj.setFieldValue('externalid', dataIn['batch_id']); // externalID might create problems if the same batch_ID ever comes back.

        //
        for (var itemCnt = 0; itemCnt < dataIn['items'].length; itemCnt++) {
            itemLine = dataIn['items'][itemCnt];
            adjType_factor = 1;
            adjType_Search = itemLine['item_description'].toLowerCase().indexOf('decrease');
            if (adjType_Search > 0) {
                adjType_factor = -1;
                itemWithQtyDecrease += 1;
            }
            else {
                itemWithQtyIncrease += 1;
            }

            //nlapiLogExecution("debug", "Restlet -CreateInvAdj check-items ", itemLine['item'] + '--' + itemLine['item_binPickedUp']);
            record_InvAdj.selectNewLineItem('inventory');
            record_InvAdj.setCurrentLineItemValue('inventory', 'item', itemLine['item']);
            record_InvAdj.setCurrentLineItemValue('inventory', 'adjustqtyby', itemLine['quantityField']);
            if (adjType_factor >= 1)
                record_InvAdj.setCurrentLineItemValue('inventory', 'unitcost', itemLine['unitprice']);

            record_InvAdj.setCurrentLineItemValue('inventory', 'memo', itemLine['item_description']);
            record_InvAdj.setCurrentLineItemValue('inventory', 'location', itemLine['item_location']);
            record_InvAdj.setCurrentLineItemValue('inventory', 'custcol_mb_item_parent', itemLine['item_parent']);
            record_InvAdj.setCurrentLineItemValue('inventory', 'custcol_mb_item_pack_size', itemLine['item_pack_size']);
            record_InvAdj.setCurrentLineItemValue('inventory', 'class', itemLine['item_ns_channel']);
            //record_InvAdj.commitLineItem('inventory');

            ns_itemBins = itemLine['item_ns_item_bin'];

            a_itmAdjBin = ns_itemBins.split(",");
            var itemBin = a_itmAdjBin[0].replace("{", "");
            var itemBinQty = a_itmAdjBin[1] * adjType_factor;

            //nlapiLogExecution("debug", "Restlet -CreateInvAdj ns_itemBins", itemLine['item'] + '##' + itemLine['item_location'] + '##' +
            //    itemLine['item_binPickedUp'] + '##' + ns_itemBins + '##' + a_itmAdjBin[0].replace("{", "") + '##' + a_itmAdjBin[1] + '##' + adjType_factor + '##' + itemBin + '##' + itemBinQty);

            var x = record_InvAdj.createCurrentLineItemSubrecord('inventory', 'inventorydetail');
            x.selectNewLineItem('inventoryassignment'); // --> Sublist of Subrecord

            //x.setCurrentLineItemValue('inventoryassignment', 'issueinventorynumber', 'testserial'); --'receiptinventorynumber'
            x.setCurrentLineItemValue('inventoryassignment', 'binnumber', itemBin); //  //result.error = "Ship Item (~0) is on file. Skipping Create. ".replace("~0", itemId);
            x.setCurrentLineItemValue('inventoryassignment', 'quantity', itemBinQty);

            x.commitLineItem('inventoryassignment'); // submit the values set in Sublist of the Subrecord
            x.commit(); // submit Subrecord			
            record_InvAdj.commitLineItem('inventory');
        }
        try {
            //nlapiLogExecution('audit', 'invAdjust record about to Committ : ', ' for ' + dataIn['invNumber']);
            record_InvAdj.setFieldValue('memo', dataIn['batch_id'] + '_' + typeOfInvAdj + ' # Total items : ' + dataIn['items'].length +
                ' (Increase : ' + itemWithQtyIncrease + ' and Decrease : ' + itemWithQtyDecrease + ')');
            var invAdj_RecordId = nlapiSubmitRecord(record_InvAdj);
            result.id = "InternalID of invAdjust record Id : " + invAdj_RecordId;
            result.error = "";
            results.push(result);
            result = initRes(recordType);
        }
        catch (ex) {
            var errMsg = errText(ex);
            nlapiLogExecution("error", "buildInvAdjust COMMIT - post Restlet Error", ex);
            result.id = "";
            result.error = "buildInvAdjust COMMIT  - post Restlet Error\n" + errMsg;
            results.push(result);
            result = initRes(recordType);
            return (results);
        }

    } //Main TRY

    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "buildInvAdjust MAIN - post Restlet Error", ex);
        result.id = "";
        result.error = "buildInvAdjust MAIN - post Restlet Error\n" + errMsg;
        results.push(result);
        result = initRes(recordType);
    }
    return (results);
}




function buildInvoice(dataIn) {
    try {
        var recordType = dataIn['recordtype'];
        var itemCount = dataIn['items'];
        //nlapiLogExecution("debug", "Restlet check(buildItem) itemcount & recordType ", itemCount + '--' + recordType + '--' + JSON.stringify(dataIn));

        //nlapiLogExecution("debug", "Restlet check(buildItem) values are ", dataIn['invNumber'] + '--' + 	dataIn['ns_vendorid'] + '--' +
        //dataIn['txn_date']+ '--' +	dataIn['ns_location']+ '--' +	dataIn['ns_subsidiary']);

        var results = new Array();
        var result = initRes(recordType);

        var invRecord = createInvoice(dataIn);
        nlapiLogExecution("debug", "InvRecord created is ", invRecord);

        if (invRecord > 0) //!= undefined || invRecord != null)
        {
            //nlapiLogExecution("debug", "InvRecord going to results  ", invRecord);
            result.id = "InternalID of Invoice created is : " + invRecord;
            result.error = "";
            results.push(result);
            result = initRes(recordType);
        }
        else {
            //nlapiLogExecution("error", "InvNumber for " + dataIn['invNumber'] + "  has failed. ", invRecord);
            result.id = "";
            result.error = "Invoice Number for " + dataIn['invNumber'] + " and has failed " + invRecord;
            results.push(result);
            result = initRes(recordType);
        }

    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", recordType + " : buildInvoice - post Restlet Error", ex);
        result.id = "";
        result.error = recordType + " : buildInvoice - post Restlet Error\n" + errMsg;
        results.push(result);
        result = initRes(recordType);
    }
    return (results);
}


function buildDropShip(dataIn) {
    try {
        var recordType = dataIn['recordtype'];
        var itemCount = dataIn['items'];
        //nlapiLogExecution("debug", "Restlet check(buildItem) itemcount & recordType ", itemCount + '--' + recordType + '--' + JSON.stringify(dataIn));

        //nlapiLogExecution("debug", "Restlet check(buildItem) values are ", dataIn['invNumber'] + '--' + 	dataIn['ns_vendorid'] + '--' +	
        //dataIn['txn_date']+ '--' +	dataIn['ns_location']+ '--' +	dataIn['ns_subsidiary']);

        var results = new Array();
        var result = initRes(recordType);
        var recObj_PO = '';

        recObj_PO = nlapiCreateRecord('purchaseorder');
        recObj_PO.setFieldValue('memo', "StoreID_InvNumber : " + dataIn['storeID'] + "_" + dataIn['invNumber']);
        recObj_PO.setFieldValue('entity', dataIn['ns_vendorid']);
        recObj_PO.setFieldValue('trandate', dataIn['txn_date']);
        recObj_PO.setFieldValue('currency', dataIn['ns_currency']); //mainly for invoice.
        recObj_PO.setFieldValue('class', dataIn['ns_channel']);		//added 9/28/2017
        recObj_PO.setFieldValue('tranid', "Dropship_" + dataIn['storeID'] + "_" + dataIn['invNumber']);
        recObj_PO.setFieldValue('location', dataIn['ns_location']);
        recObj_PO.setFieldValue('subsidiary', dataIn['ns_subsidiary']);
        //recObj_PO.setFieldValue('taxcode','11'); //commented as NS puts default value. Also itemLines have tax... 

        //nlapiLogExecution("debug", "Restlet 2nd check-items length", dataIn['items'].length); // + '--' + dataIn['items'].[1].['quantity']);
        var itemLine = '';
        for (var itemCnt = 0; itemCnt < dataIn['items'].length; itemCnt++) {
            itemLine = dataIn['items'][itemCnt];
            nlapiLogExecution("debug", "Restlet item at index " + itemCnt, itemLine['item'] + '--' + itemLine['item_description'] + '--' + itemLine['quantityField'] + '--' + itemLine['unitprice']);

            recObj_PO.selectNewLineItem('item');
            recObj_PO.setCurrentLineItemValue('item', 'item', itemLine['item']);
            recObj_PO.setCurrentLineItemValue('item', 'quantity', itemLine['quantityField']);
            recObj_PO.setCurrentLineItemValue('item', 'rate', itemLine['unitprice']);
            recObj_PO.setCurrentLineItemValue('item', 'amount', itemLine['lineamount']);
            recObj_PO.setCurrentLineItemValue('item', 'description', itemLine['item_description']);
            recObj_PO.setCurrentLineItemValue('item', 'taxcode', itemLine['item_taxcode']); //'11'
            recObj_PO.commitLineItem('item');
        }
        //nlapiLogExecution("debug", "Restlet check(buildItems PO)", ' About to commit');

        try {
            var po_id = nlapiSubmitRecord(recObj_PO, true, true);
            //nlapiLogExecution('audit', 'PO record Id : ', ' for ' + dataIn['invNumber'] + ' is ' + po_id);
        }
        catch (ex) {
            var errMsg = errText(ex);
            nlapiLogExecution("error", "PO Number generation failed : buildItem ", ex);
            result.error = "PO Number generation failed : buildItem \n" + errMsg;
            result.id = "";
            results.push(result);
            result = initRes(recordType);
            return (results);
        }

        if (po_id > 0) //Make sure PO is created... If this if condition doesn't work, then do a search by the invoiceNr (memo) to make sure.
        { // transform to item receipt.
            result.id = "Memo : Details for Dropship record with Shipworks invoice number " + dataIn['invNumber'] + " is as below,";
            result.error = "";
            results.push(result);
            result = initRes(recordType);

            result.id = "a) InternalID of Purchase Order number : " + po_id;
            result.error = "";
            results.push(result);
            result = initRes(recordType);

            //nlapiLogExecution('debug', 'Entering item receipt : ', ' for ' + dataIn['invNumber'] + ' --' + dataIn['txn_date'] + ' is to be created ');

            // Transforming the record to Item Receipt 
            try {
                var itemReceipt_Record = nlapiTransformRecord('purchaseorder', po_id, 'itemreceipt');
                var itemCount = itemReceipt_Record.getLineItemCount('item');
                itemReceipt_Record.setFieldValue('trandate', dataIn['txn_date']); //PO Receipt date should be same as PO date.
                itemReceipt_Record.setFieldValue('memo', "Dropship_" + dataIn['storeID'] + "_" + dataIn['invNumber']); //PO Receipt date should be same as PO date.
                var itemReceipt_id = nlapiSubmitRecord(itemReceipt_Record, true);
                //nlapiLogExecution("debug", "reached AFTER nlspisubmit for itemReceipt ", '');
            }
            catch (ex) {
                var errMsg = errText(ex);
                nlapiLogExecution("error", "Item Receipt (PO)  generation failed : buildItem ", ex);
                result.error = "buildItem : Item Receipt (PO) generation failed. PO transaction : " + po_id + " has NOT been rolled back :  \n" + errMsg;

                results.push(result);
                result = initRes(recordType);
                //rollback the PO record that was created.
                return (results);
            }

            //nlapiLogExecution('audit', 'Item Receipt record Id : ', ' for ' + dataIn['invNumber'] + ' with PO nr : ' + po_id + ' is ' + itemReceipt_id);
            result.id = "b) InternalID of Item receipt : " + itemReceipt_id;
            result.error = "";
            results.push(result);
            result = initRes(recordType);

            if (itemReceipt_id > 0) {
            }
            else {
                result.error = "ItemReceipt is " + itemReceipt_id + " and has failed. Linked PO " + po_id + " has NOT been deleted";
                results.push(result);
                result = initRes(recordType);
            }
        }
        else {
            result.error = "PONumber is " + po_id + " and has failed";
            results.push(result);
            result = initRes(recordType);
        }

    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "buildDropship - post Restlet Error", ex);
        result.error = "buildDropship  - post Restlet Error\n" + errMsg;
        results.push(result);
        result = initRes(recordType);
        //continue;
    }
    return (results);
}


function setRecord(data) {
    var retObj = createInvoice(data);

    return JSON.stringify(retObj);
}

function SetCustomerShipAddress(nsCustomer, nsShipAddressId) {
    try {
        var cust = nlapiLoadRecord('customer', nsCustomer)
        var addrFound = false;
        for (var c = 1; c <= cust.getLineItemCount('addressbook'); c++) {
            nlapiLogExecution("debug", "SetCustomerShipAddress inside ", cust.getCurrentLineItemValue('addressbook', 'id'));
            cust.selectLineItem('addressbook', c) //x 
            if (cust.getCurrentLineItemValue('addressbook', 'id') == nsShipAddressId) {
                nlapiLogExecution("debug", "SetCustomerShipAddress found ID ", nsShipAddressId);
                cust.setCurrentLineItemValue('addressbook', 'defaultshipping', 'T');
                cust.commitLineItem('addressbook');
                nlapiSubmitRecord(cust);

                nlapiLogExecution("debug", "Customer Record commited ", nsCustomer);
                addrFound = true;
                break
            }
        }
    }
    catch (ex) {
        var errMsg = errText(ex);
        var invErr = "Error in Invoice :SetCustomerShipAddress " + errMsg;
        nlapiLogExecution("error", "CreateInvoice (SetCustomerShipAddress) has failed ", ex);
        return invErr;
    }
    return addrFound;

}

function getInvoiceShipTo(InvoiceNumber) {
    nlapiLogExecution('DEBUG', 'getInvoiceShipTo : InvoiceNumber', InvoiceNumber);
    if (InvoiceNumber == "null")
        return 0;
    var invoice_shipto_internalId = 0;

    try {
        var filters = new Array();
        filters[filters.length] = new nlobjSearchFilter('custrecord_mb_invoice_shipto_internalid', null, 'is', InvoiceNumber);

        var searchResults = nlapiSearchRecord(null, 'customsearch_mb_invoice_shipto_corection', filters, null);

        if (searchResults) {
            var cols = searchResults[0].getAllColumns();
            invoice_shipto_internalId = searchResults[0].getValue(cols[0]);
            nlapiLogExecution("debug", "first element", invoice_shipto_internalId);
        }

    }
    catch (e) {
        nlapiLogExecution("error", "suiteScript() has encountered an error in getInvoiceShipTo", e);
    }
    return invoice_shipto_internalId;
}


function getEuFulfilmentRecord(OtherRefNumber, InvoiceNumber) { ////itemId, itemLocation) 
    //var OtherRefNumber  = '404-3942513-9621925';
    nlapiLogExecution('DEBUG', 'getEuFulfilmentRecord : OtherRefNumber,InvoiceNumber', OtherRefNumber + ' --' + InvoiceNumber);
    var eu_fulfil_internalId = 0;
    try {
        var filters = new Array();
        filters[filters.length] = new nlobjSearchFilter('custrecord_mb_eu_amz_invoice', null, 'is', OtherRefNumber);

        var searchResults = nlapiSearchRecord(null, 'customsearch_mb_eu_fulfilments_2', filters, null);

        if (searchResults) {
            //nlapiLogExecution("debug", "search results", JSON.stringify(searchResults));
            var cols = searchResults[0].getAllColumns();
            eu_fulfil_internalId = searchResults[0].getValue(cols[0]);
            nlapiLogExecution("debug", "first element", eu_fulfil_internalId);
        }
    }
    catch (e) {
        nlapiLogExecution("error", "suiteScript() has encountered an error in getEuFulfilmentRecord", e);
    }
    return eu_fulfil_internalId;
}

function createInvoice(dataIn) {
    try {

        var eu_fulfil_recordID = 0;
        var invoice_shipto_recordID = 0;
        var IsInvoiceCorrection = false;
        var actual_ship_to_contactname = dataIn['ship_contactname'];
        if (actual_ship_to_contactname != "" || actual_ship_to_contactname != "null") {
            actual_ship_to_contactname = actual_ship_to_contactname.replace("DELETE=", "");

            if (actual_ship_to_contactname != dataIn['ship_contactname']) {
                IsInvoiceCorrection = true;
                dataIn['ship_contactname'] = "";
            }
        }
        if (dataIn['invNumber'].substring(0, 3) == "400") {
            nlapiLogExecution("debug", "shipAddress update is ", dataIn['ns_customer'] + "##" + dataIn['ns_linked_txn_nr']);
            eu_fulfil_recordID = getEuFulfilmentRecord(dataIn['OrderNumber'], dataIn['invNumber']);
            nlapiLogExecution("debug", "eu_fulfil_recordID :", eu_fulfil_recordID);

            if (eu_fulfil_recordID == 0) {
                var invErr = "EU invoice :" + dataIn['invNumber'] + " has no Eu fulfillment record (or if already imported, reset nsInvoiceInternalId value). Exiting...";
                nlapiLogExecution("error", "CreateInvoice has failed ", invErr);
                return invErr;
            }

            var shipAddress = SetCustomerShipAddress(dataIn['ns_customer'], dataIn['ns_linked_txn_nr']);
            //note "ns_linked_txn_nr"  is used for EU invoices only to denote the ID of the addressbook as visible in Customer record.
            //nlapiLogExecution("debug", "shipAddress update is ", shipAddress); 	
            if (shipAddress == false) {
                var invErr = "EU invoice :" + dataIn['invNumber'] + " has no defaultShipAddress (or addressID not linked to Customer Record). Exiting...";
                nlapiLogExecution("error", "CreateInvoice has failed ", invErr);
                return invErr;
            }
        }

        if (IsInvoiceCorrection == true) // (dataIn['ship_contactname'] != "") //for invoices this field has the invoice that needs to be deleted.
        {
            nlapiLogExecution("debug", "invoice ShipTo value is ", actual_ship_to_contactname);
            invoice_shipto_recordID = getInvoiceShipTo(actual_ship_to_contactname);
            nlapiLogExecution("debug", "invoice_shipto_recordID :", invoice_shipto_recordID);

            if (invoice_shipto_recordID == 0) {
                var invErr = " invoice :" + dataIn['invNumber'] + " has no proper invoice value to correct or has already been corrected. Exiting...";
                nlapiLogExecution("error", "CreateInvoice has failed ", invErr);
                return invErr;
            }
            //delete the invoice here.
            try {
                nlapiDeleteRecord("invoice", actual_ship_to_contactname);
            }
            catch (e) {
                nlapiLogExecution('debug', 'Invoice shipto correction : deletion : ', e);
            }

        }


        var record_Inv = nlapiCreateRecord('invoice');
        // var record_Inv = nlapiCreateRecord('invoice', { recordmode: 'dynamic', entity: dataIn['ns_customer'] });

        var today = new Date();
        var cutOff = new Date("9/1/2022");
        var skipTheseSubs = "26,29,14"; 
        var skipSync = (today < cutOff) || skipTheseSubs.indexOf(dataIn['ns_subsidiary']) >=0  || "CA,US".indexOf(dataIn['Ship_to_country']) <0;
         
        if (skipSync) 
            record_Inv.setFieldValue('custbody_tj_sync_skip', 'T'); 		// RCM Set skip sync for Taxjar
        else{
            record_Inv.setFieldValue('custbody_tj_external_tax_amount', parseFloatOrZero(dataIn['header_tax']));
        }

        var entityName = nlapiLookupField('customer', dataIn['ns_customer'], 'companyname');
        var tjProvider = "api";
        if (entityName) {
            tjProvider = entityName.toLowerCase().indexOf("amazon") >= 0 ? "amazon" : tjProvider;
            tjProvider = entityName.toLowerCase().indexOf("walmart") >= 0 ? "walmart" : tjProvider;
        }
        record_Inv.setFieldValue('custbody_tj_provider', tjProvider);

        record_Inv.setFieldValue('customform', invoiceForm);  //internalID of the form that has custom fields (for invoice record).
        record_Inv.setFieldValue('entity', dataIn['ns_customer']); //defaultCustomer);

        record_Inv.setFieldValue('class', dataIn['ns_channel']);
        record_Inv.setFieldValue('subsidiary', dataIn['ns_subsidiary']);
        record_Inv.setFieldValue('location', dataIn['ns_location']);        

        record_Inv.setFieldValue('memo', "Inv Nr : " + dataIn['invNumber'] + ", PO# : " + dataIn['OrderNumber'] + ", BatchID : " + dataIn['batch_id']
            + ", Invoice total : " + dataIn['invoice_total_final'] + ", tax : " + dataIn['header_tax']);

        record_Inv.setFieldValue('custbody_mb_source_invoice_total', dataIn['invoice_total_final']);
        record_Inv.setFieldValue('custbody_mb_source_inv_tax_amount', dataIn['header_tax']);

        record_Inv.setFieldValue('currency', dataIn['ns_currency']); //mainly for invoice.

        //var nsLinkedTxn = parseFloat(dataIn['ns_linked_txn_nr']);
        //nlapiLogExecution("debug", "ns_linked_txn_nr ", dataIn['ns_linked_txn_nr'].toLowerCase() + '**'+nsLinkedTxn); 

        //if (dataIn['ns_linked_txn_nr'] != ""  && parseFloat(dataIn['ns_linked_txn_nr']) > 0 )
        if (dataIn['ns_linked_txn_nr'] != "" && parseFloat(dataIn['ns_linked_txn_nr']) > 0 && dataIn['invNumber'].substring(0, 3) != "400")
            record_Inv.setFieldValue('custbody_mb_linked_txn_in_invoice', dataIn['ns_linked_txn_nr']);

        record_Inv.setFieldValue('tranid', dataIn['invNumber']);
        record_Inv.setFieldValue('trandate', dataIn['txn_date']);

        //record_Inv.setFieldValue('approvalstatus', 2);
        record_Inv.setFieldValue('trackingnumbers', dataIn['tracking_Number']);
        record_Inv.setFieldValue('terms', dataIn['ns_payment_terms']);
        record_Inv.setFieldValue('custbody_mb_ship_method_shipworks', dataIn['shipping_method']);
        record_Inv.setFieldValue('custbody_mb_shipping_weight', dataIn['shipping_weight']);
        record_Inv.setFieldValue('custbody_mb_shipping_account_nr', dataIn['shipping_account']);
        record_Inv.setFieldValue('custbody_mb_shipworks_coupon', dataIn['coupon_code']);
        record_Inv.setFieldValue('otherrefnum', dataIn['OrderNumber']); //OrderID
        record_Inv.setFieldValue('custbody_mb_inv_shipworks_orderid', dataIn['OrderID']);

        //record_Inv.setFieldValue('duedate',dataIn['due_date']);
        record_Inv.setFieldValue('shipdate', dataIn['ship_date']);
        record_Inv.setFieldValue('custbody_mb_shipto_phone', dataIn['ship_to_contact_phone']);
        record_Inv.setFieldValue('custbody_mb_packaging_type', dataIn['PackagingType']);
        record_Inv.setFieldValue('custbody_mb_order_scanned_by', dataIn['Scanned_User']);
        record_Inv.setFieldValue('custbody_mb_order_printed_by', dataIn['Printed_User']);
        record_Inv.setFieldValue('custbody_mb_reference_2', dataIn['Shipping_Reference2']);
        record_Inv.setFieldValue('custbody_mb_reference_1', dataIn['Shipping_Reference1']);
        record_Inv.setFieldValue('custbody_mb_third_party_ship_act', dataIn['Third_Party_Shipping_Account']);
        record_Inv.setFieldValue('custbody_mb_third_party_shipping_flag', dataIn['Third_Party_Shipping_Flag']);
        record_Inv.setFieldValue('custbody_mb_recalc_gp', 'T');

        record_Inv.setFieldValue('istaxable', dataIn['header_tax'] > 0 ? 'T' : 'F');

        if (dataIn['header_discount'] != 0) {
            record_Inv.setFieldValue('discountrate', dataIn['header_discount']);
            record_Inv.setFieldValue('discountitem', discountOnProduct); //discountPerInvoice  discountOnProduct); //
            if ((dataIn['header_ship_charge']) == (dataIn['header_discount'] * -1)) {
                record_Inv.setFieldValue('discountitem', dataIn['discountitem']);
            }
            record_Inv.setFieldValue('custbody_mb_inv_header_discount', dataIn['header_discount']);
        }

        var IsSetShip = 1;
        var nsDefault_eu_shipAddr = '';

        nlapiLogExecution("debug", "country##invoice ", dataIn['Ship_to_country']+"##"+dataIn['invNumber']);                
        // AMAZON FBA (200) invoice  going to foreign countries (skipsync) should use a preset domestic address (defaultshippingaddress of customer)                 
        if (dataIn['invNumber'].substring(0, 3) == "200" &&  "CA,US".indexOf(dataIn['Ship_to_country']) <0) {
        //if (dataIn['invNumber'].substring(0, 3) == "200" &&  dataIn['Ship_to_country'] !="US") {    
            IsSetShip = 0; //0 new shipTo is not created but if the associated entity has defaultShipping it will be sourced to invoice.
            record_Inv.setFieldValue('custbody_tj_sync_skip', 'T'); 		// RCM Set skip sync for Taxjar
            record_Inv.setFieldValue('custbody_tj_external_tax_amount', parseFloatOrZero(dataIn['header_tax']));
            nlapiLogExecution("debug", "set ", dataIn['Ship_to_country']+"##"+dataIn['invNumber']);
            //dataIn['items'][0]['item_taxcode'] = "0";
            if(dataIn['items'].length>0){
                var newItems = dataIn['items'].map(function(line){
                    line.item_taxcode ="0";
                    return line; 
                });
                dataIn['items'] = newItems;
            } 
        }

        // if (dataIn['invNumber'].substring(0, 3) == "200" &&  dataIn['Ship_to_country'] == "CA" && dataIn['header_tax'] == 0 ) {
        //     dataIn['items'][0]['item_taxcode'] = "0"; // dont set any taxitems when theres no tax amount. 
        // }

        if (dataIn['invNumber'].substring(0, 3) == "400") {
            //if (dataIn['Ship_to_country'] != "GB")    //commented for testing Jun 12,2019
            {
                IsSetShip = 0; //0 new shipTo is not created but if the associated entity has defaultShipping it will be sourced to invoice.
                nsDefault_eu_shipAddr = (dataIn['ns_linked_txn_nr']);
            }
        }
        //nlapiLogExecution("debug", "isSetShip ", IsSetShip  + '--'+dataIn['Ship_to_country'] + '--'+dataIn['Ship_to_state'] +'--'+dataIn['shipping_item'] );
        //nlapiLogExecution("debug", "ship_to_full_address ", dataIn['ship_to_full_address']);
        if (IsSetShip == 1) {
            var addr = record_Inv.createSubrecord('shippingaddress');
            addr.setFieldValue('country', dataIn['Ship_to_country']);
            //addr.setFieldValue('addressee', ''); //
            addr.setFieldValue('addressee', dataIn['ship_to_name']); //commented above and added on 2020Nov23
            addr.setFieldValue('attention', dataIn['ship_contactname'] + ', ' + dataIn['ship_to_name'] + ', ' + dataIn['ship_to_address_line_two']);
            addr.setFieldValue('addr1', dataIn['ship_to_address_line_one']);
            //addr.setFieldValue('addr2', dataIn['']);
            addr.setFieldValue('city', dataIn['ship_to_city']);
            addr.setFieldValue('state', dataIn['Ship_to_state']);
            addr.setFieldValue('zip', dataIn['ship_to_zipcode']);
            //addr.setFieldValue('externalid', dataIn['invNumber']+'_'+ dataIn['ship_to_zipcode']);

            //addr.setFieldValue('override', 'T'); 
            addr.commit();
            //nlapiLogExecution("debug", "address shipTo committed ", dataIn['ship_to_full_address']);
        }


        // Added Aug 21st 2020
        if (IsSetShip == 10) {

            var shipToSelect = record_Inv.setFieldValue('shipaddresslist', ""); //-2 is the internal ID of the '- Custom -' value			  
            //Amazon Rugeley - Goods in Amazon ES FBA Towers Business Park, Power Station Road Rugeley Staffordshire WS15 1NZ United Kingdom			  
            //
            switch (nsDefault_eu_shipAddr) {
                case '3846239':
                    {
                        var addr = record_Inv.createSubrecord('shippingaddress');
                        addr.setFieldValue('country', 'GB');
                        addr.setFieldValue('addressee', '');
                        addr.setFieldValue('attention', 'Amazon Rugeley - Goods in Amazon ES FBA');
                        addr.setFieldValue('addr1', 'Towers Business Park');
                        addr.setFieldValue('addr2', 'Power Station Road');
                        addr.setFieldValue('city', ''); // 'Rugeley');
                        addr.setFieldValue('state', ''); //Staffordshire');
                        addr.setFieldValue('zip', ''); //WS15 1NZ');
                        //addr.setFieldValue('override', 'T'); 
                        addr.commit();
                    }
                    break;
                case '123':
                    break;
                default:
                    nlapiLogExecution("debug", "unDefined nsDefault_eu_shipAddr", nsDefault_eu_shipAddr);
                    break;
            }
            //
            //nlapiLogExecution("debug", "address shipTo committed ", dataIn['ship_to_full_address']);
        }

        //
        if (IsInvoiceCorrection == true)
            record_Inv.setFieldValue('custbody_mb_invoice_shipto', dataIn['ship_to_full_address'].replace("DELETE=" + actual_ship_to_contactname, ""));
        else
            record_Inv.setFieldValue('custbody_mb_invoice_shipto', dataIn['ship_to_full_address']);

        //record_Inv.setFieldValue('shipaddress',dataIn['ship_to_full_address']);  //Not required...'Mibar.Net, 1430, Broadway, NY-10018');
        if (dataIn['shipping_item'] != '') {
            record_Inv.setFieldValue('shipmethod', dataIn['shipping_item']); // 	);
        }
        else {
            if (dataIn['shipping_method'] != '' || dataIn['header_ship_charge'] > 0) {
                //nlapiLogExecution("debug", "setting shipping based on sub  ", dataIn['shipping_method'].toLowerCase() + "--" + dataIn['header_ship_charge'] 
                //+ "--" +dataIn['subsidiary_shipping_item']); //pramodmay29th only testing
                record_Inv.setFieldValue('shipmethod', dataIn['subsidiary_shipping_item']); // ); 
                //setFieldValue('shipmethod', default_shipping_method) //should be handled at sourceData... because  shipmethod is unique per sub and can't have same internal Id.
                if(dataIn['items'][0]['item_taxcode'] !="0") record_Inv.setFieldValue('shippingtaxcode', dataIn['items'][0]['item_taxcode']);
            }            
        }
        if(dataIn['items'][0]['item_taxcode'] !="0") record_Inv.setFieldValue('shippingtaxcode', dataIn['items'][0]['item_taxcode']);

        if (dataIn['header_tax'] > 0 ) {
            nlapiLogExecution("debug", " dataIn['header_tax']", dataIn['header_tax'] + "--" + dataIn['items'][0]['item_taxcode']);
            record_Inv.setFieldValue('taxitem', dataIn['items'][0]['item_taxcode']);
            //record_Inv.setFieldValue('taxtotal',dataIn['header_tax']);
            //movd above...record_Inv.setFieldValue('shippingtaxcode', dataIn['items'][0]['item_taxcode']);
            //record_Inv.setFieldValue('shippingtax1rate', dataIn['header_tax_rate']);
            //record_Inv.setFieldValue('taxrate', dataIn['header_tax_rate'].replace("%","")); //jun12th2019
            //record_Inv.setFieldValue('taxrate', '.6875'); //record_Inv.setFieldValue('taxtotal',dataIn['header_tax']);
        }

        if (dataIn['header_ship_charge'] > 0) {
            nlapiLogExecution("debug", "setting shipping charge  ", dataIn['shipping_method'].toLowerCase() + "--" + dataIn['header_ship_charge'] + "--" + dataIn['shipping_cost']);
            record_Inv.setFieldValue('shippingcost', dataIn['header_ship_charge']);		//record_Inv.setFieldValue('altshippingcost',dataIn['header_ship_charge']);
        }
        if (dataIn['shipping_cost'] > 0) {
            record_Inv.setFieldValue('custbody_mb_shipping_cost', dataIn['shipping_cost']);
        }

        //nlapiLogExecution("debug", "Restlet within CreateInvoice : Customer & items length", dataIn['ns_customer'] 
        //+ '^^^' + dataIn['items'].length); // + '--' + dataIn['items'].[1].['quantity']); //pramodmay29th
        var itemLine = '';
        var mainBinWithKitBin;
        var IsAnyItemAKit = 0;

        for (var itemCnt = 0; itemCnt < dataIn['items'].length; itemCnt++) {
            itemLine = dataIn['items'][itemCnt];
            nlapiLogExecution("debug", "Restlet -CreateInvoice check-items ", itemLine['item'] + '--' + itemLine['item_binPickedUp'] + '--' + itemLine['lineamount'] + '--' + itemLine['quantityField']);

            record_Inv.selectNewLineItem('item');
            record_Inv.setCurrentLineItemValue('item', 'item', itemLine['item']);
            record_Inv.setCurrentLineItemValue('item', 'location', itemLine['item_location']);
            record_Inv.setCurrentLineItemValue('item', 'quantity', itemLine['quantityField']);
            record_Inv.setCurrentLineItemValue('item', 'rate', itemLine['unitprice']);
            record_Inv.setCurrentLineItemValue('item', 'amount', itemLine['lineamount']);

            if (itemLine['item_flag'].toLowerCase() == "kit") {
                //IsAnyItemAKit = 1;
                nlapiLogExecution("debug", "Restlet -CreateInvoice KIT : check-items :item_flag", itemLine['item'] + '--' + itemLine['item_flag']);

                record_Inv.setCurrentLineItemValue("item", "groupsetup", true, true); // Specify this is a group item
                record_Inv.setCurrentLineItemValue("item", "itemtype", 'Group'); //, true, true); // Specify this is a group item
            }
            if (itemLine['item_flag'].toLowerCase() == "kitend") {
                record_Inv.setCurrentLineItemValue("item", "itemtype", 'EndGroup'); //, true, true); // end group item line

            }
            if (itemLine['item_flag'].toLowerCase() == "kitcomp") {
                record_Inv.setCurrentLineItemValue("item", "ingroup", 'T'); //, true, true); //Specify that it is included in the group
            }

            mainBinWithKitBin = itemLine['item_binPickedUp'];

            if (itemLine['item_kit_info'] != "")
                mainBinWithKitBin = mainBinWithKitBin + "~" + itemLine['item_kit_info'];

            if (itemLine['item_flag'].toLowerCase() == "kitcomp" || itemLine['item_flag'].toLowerCase() == "") {
                record_Inv.setCurrentLineItemValue('item', 'custcol_mb_bin_information', itemLine['item_binPickedUp']); // itemLine['item_binPickedUp']
            }

            if (itemLine['item_flag'].toLowerCase() == "kit" || itemLine['item_flag'].toLowerCase() == "") {
                record_Inv.setCurrentLineItemValue('item', 'description', itemLine['item_description']);
            }

            //record_Inv.setCurrentLineItemValue('item', 'custcol_mb_kit_information', itemLine['item_kit_info']);
            //record_Inv.setCurrentLineItemValue('item', 'price', 6);

            if (itemLine['item_taxcode'] != "0") {
                nlapiLogExecution("debug", "lineItem :item_taxcode is NOT zero ", itemLine['item_taxcode']);
                record_Inv.setCurrentLineItemValue('item', 'taxcode', itemLine['item_taxcode']); //'11'
                record_Inv.setCurrentLineItemValue('item', 'istaxable', 'T');
                if (dataIn['header_tax_rate'] != "") {  // taxrate1 override if done for Canada should be taken care. taxrate1 is only hst/gst and taxrate2 is only PST.
                    record_Inv.setCurrentLineItemValue('item', 'taxrate1', dataIn['header_tax_rate']); //+'%'); removed % as it comes from the source data.
                }
                if (dataIn['invNumber'].substring(0, 3) == "300" && (dataIn['Ship_to_state'] == "BC" || dataIn['Ship_to_state'] == "PE")) {
                    //nlapiLogExecution("debug", "lineItem :ship state is ", dataIn['Ship_to_state'].toLowerCase()); 
                    //record_Inv.setCurrentLineItemValue('item', 'taxcode', '22'); // '' //12848 for PE commented on feb 8th.
                    //record_Inv.setCurrentLineItemValue('item', 'taxrate1', '13%'); 
                    //record_Inv.setCurrentLineItemValue('item', 'taxrate2', '7'); 
                }
            }
            record_Inv.commitLineItem('item');
        }

        //Restlet POST request sample (Also add the authorization and content-type headers): // {"entity":"8","recordtype":"invoice","location":"1","taxItem":"CA-ALAMEDA","itemList":[{"item":"4","quantity":"1"}]}
        var custom_summary_info = '';
        //custom_summary_info = "\n" + spacePad(dataIn['invoice_total_final'], 6) + " : Invoice SubTotal\n"; // + ' ('+ dataIn['invoice_total_final'] + ')\n';
        //custom_summary_info = custom_summary_info + spacePad(dataIn['invoice_total_final'], 6) + " : Discount\n";

        custom_summary_info = "\n====================================\n"; // + ' ('+ dataIn['invoice_total_final'] + ')\n';
        custom_summary_info += (dataIn['item_subtotal']) + " : Item subTotal\n"; // + ' ('+ dataIn['invoice_total_final'] + ')\n';
        custom_summary_info += " " + (dataIn['original_header_discount']) + " : Discount\n";
        custom_summary_info += (dataIn['original_header_ship_charge']) + " : Shipping\n";
        custom_summary_info += (dataIn['original_header_tax']) + " : Tax\n";
        custom_summary_info += "====================================\n";
        //custom_summary_info +=  "<b>====================================</b>\n";  // <b></b> is not working.
        custom_summary_info += (dataIn['invoice_total_final']) + " : Grand Total\n"; //padSpace

        //custom_summary_info = "\n" + spacePad(dataIn['item_subtotal'],15) + " : Item subTotal\n"; // + ' ('+ dataIn['invoice_total_final'] + ')\n';
        //custom_summary_info = custom_summary_info + spacePad(dataIn['original_header_discount'],15) + " : Discount\n";
        //custom_summary_info = custom_summary_info + spacePad(dataIn['original_header_ship_charge'],15) + " : Shipping\n";
        //custom_summary_info = custom_summary_info + spacePad(dataIn['original_header_tax'],15) + " : Tax\n";
        //custom_summary_info = custom_summary_info + spacePad(dataIn['invoice_total_final'],15) + " : Grand Total\n";

        record_Inv.setFieldValue("custbody_mb_inv_final_total", custom_summary_info);
        record_Inv.setFieldValue("custbody_mb_inv_final", custom_summary_info);
        record_Inv.setFieldValue("custbody_mb_inv_final", custom_summary_info);
        custom_summary_info += "<b>====================================</b>\n";  // <b></b> is not working.
        record_Inv.setFieldValue("custbody_mb_inv_summary_info", custom_summary_info);

        // The below submit and reopening should be done only if there is an itemGroup. You can find out that if the KitComponents (aka gift_Desc is not blank).
        // The gift_desc should have kitComponentId,KitComponentPrice,Percentage,Qty. 

        /*
        if (dataIn['header_tax'] > 0) {
            //nlapiLogExecution("debug", " just before commiting : shippingtaxcode", dataIn['header_tax'] + "--" + dataIn['items'][0]['item_taxcode']);
            record_Inv.setFieldValue('shippingtaxcode', dataIn['items'][0]['item_taxcode']);
        }*/

        var context = nlapiGetContext();
        var usageRemaining = context.getRemainingUsage();
        //nlapiLogExecution("debug", " before submit  of invoice usage is ", usageRemaining + '--Invoice is :' 
        //+dataIn['invNumber'] +'##'+dataIn['header_ship_charge']+ '$$'+dataIn['shipping_item']+'%%'+dataIn['OrderNumber']); //pramodmay29th
        //nlapiLogExecution("debug", " Now comitting  ", dataIn['OrderNumber']); //pramodmay29th

        //nlapiLogExecution("debug", " Now writing  ", JSON.stringify(record_Inv));

        var invRecordId = nlapiSubmitRecord(record_Inv);
        var usageRemaining_after = context.getRemainingUsage();
        nlapiLogExecution("debug", " after submit  of invoice usage is ", usageRemaining_after + 'InternalID is ' + invRecordId);

        //
        if (dataIn['invNumber'].substring(0, 3) == "400" && eu_fulfil_recordID != 0) {
            var eu_fulfilRec = nlapiLoadRecord('customrecord_mb_eu_invoice_fulfil', eu_fulfil_recordID);
            eu_fulfilRec.setFieldValue('custrecord_mb_eu_fulfil_ns_invoice', invRecordId);
            eu_fulfilRec.setFieldValue('custrecord_mb_eu_invoice', dataIn['invNumber']);
            nlapiSubmitRecord(eu_fulfilRec);
            nlapiLogExecution("debug", " eu-invoice updated in eu-fulfillment record ", eu_fulfil_recordID);
        }

        if (invoice_shipto_recordID != 0) {
            var invoice_Shipto_record = nlapiLoadRecord('customrecord_mb_invoice_shiptodetails', invoice_shipto_recordID);
            invoice_Shipto_record.setFieldValue('custrecord_mb_invoice_shipto_corrected', invRecordId);
            nlapiSubmitRecord(invoice_Shipto_record);
            nlapiLogExecution("debug", " invoice corrected value updated in invoiceShipTo details record ", invoice_shipto_recordID);
        }

        //
        //nlapiLogExecution("debug", " submitRecord of invoice ", invRecordId);

        if (IsAnyItemAKit == 1) //(dataIn['parents_flag'].toLowerCase() == 'kit')
        {
            { //function changeKitMembers() 
                var record2 = nlapiLoadRecord('invoice', invRecordId, { recordmode: 'dynamic' });

                var itemCount = record2.getLineItemCount('item');
                //var itemCount = nlapiGetLineItemCount('item');
                //nlapiLogExecution('DEBUG', 'itemCount is ' + itemCount, invRecordId);

                var itemname;
                var itemType;
                var revrecstartdate;
                var revrecenddate;
                var kitComponents;
                var isGroup = 'F'; //will serve as a flag

                var itemKitCompQty;
                var itemKitCompRate;
                var itemKitCompId;
                var itemKitCompLineValue;
                var arKitComponents;
                var arKitCompElements;
                var totalKitCount = 10; // get this actual count.      var  arrLen = items.length -1; items is array
                var kitFoundLocation;
                var binToAssign;
                var locationToAssign;
                var binPickedUp;
                //= defaultBins.split(",");
                //
                //loop to each items
                for (var i = 1; i <= itemCount; i++) {
                    record2.selectLineItem('item', i);

                    itemname = record2.getCurrentLineItemValue('item', 'item');
                    itemType = record2.getCurrentLineItemValue('item', 'itemtype');
                    //nlapiLogExecution("debug", " itemname and itemType  : " + i, itemname + '--' + itemType);
                    if (itemType == null || itemType == 'EndGroup') {
                        //nlapiLogExecution("debug", " Turning isGroup to false " + i, isGroup);
                        isGroup = 'F';
                    }

                    if (isGroup == 'T') {
                        if ((itemType == 'InvtPart') || (itemType == 'NonInvtPart')) {
                            //----
                            // Find if the KitComponent (aka giftDesc has the itemname in it. IF so, get the qty,rate

                            for (var kitLoop = 0; kitLoop <= totalKitCount; kitLoop++) { //
                                kitFoundLocation = arKitComponents[kitLoop].toLowerCase().indexOf(itemname.toLowerCase());
                                //nlapiLogExecution("debug", "kitFoundLocation is ", kitFoundLocation + '--' + arKitComponents[kitLoop]);
                                if (kitFoundLocation >= 0) {
                                    arKitCompElements = arKitComponents[kitLoop].split(",");
                                    itemKitCompQty = arKitCompElements[1];
                                    itemKitCompRate = arKitCompElements[2];
                                    itemKitCompLineValue = arKitCompElements[3];
                                    binToAssign = arKitCompElements[5]; //4159; //multiple bins to be scoped still.
                                    locationToAssign = arKitCompElements[6]; //4159; //multiple bins to be scoped still.
                                    binPickedUp = arKitCompElements[7];
                                    //nlapiLogExecution("debug", "itemKitCompQty, itemKitCompRate,itemKitCompLineValue  ", arKitCompElements[0] + '--' + itemKitCompQty +
                                    //    '--' + itemKitCompRate + '--' + itemKitCompLineValue + '--' + binToAssign + '--' + binPickedUp + '--' + locationToAssign);

                                    //itemKitCompId;
                                    //itemKitCompLineValue;
                                    //nlapiLogExecution("debug", "before Break-qty,bin,rate,value is ", itemKitCompQty + '--' +binToAssign + '--' +itemKitCompRate);
                                    //kitLoop = 10;
                                    break;
                                }
                            }
                            //nlapiLogExecution("debug", "after Break-qty,bin,rate,value is ", itemKitCompQty + '--'+ binToAssign + '--'+ itemKitCompRate);

                            record2.setCurrentLineItemValue('item', 'price', -1); //custom price level
                            record2.setCurrentLineItemValue('item', 'quantity', itemKitCompQty); //7

                            record2.setCurrentLineItemValue('item', 'rate', itemKitCompRate);// 11);
                            record2.setCurrentLineItemValue('item', 'amount', itemKitCompLineValue); //77);
                            record2.setCurrentLineItemValue('item', 'revrecstartdate', revrecstartdate); // Set Start Date
                            record2.setCurrentLineItemValue('item', 'revrecenddate', revrecenddate); // Set End Date
                            record2.setCurrentLineItemValue('item', 'custcol_mb_bin_information', binPickedUp);
                            record2.setCurrentLineItemValue('item', 'location', locationToAssign);

                            //nlapiLogExecution("debug", "reached inside setCurrentLineItemValue", '');
                            var subrecord2 = record2.editCurrentLineItemSubrecord('item', 'inventorydetail');
                            //nlapiLogExecution("debug", "reached editCurrentLineItemSubrecord ", '');
                            subrecord2.selectLineItem('inventoryassignment', 1);
                            //subrecord2.setCurrentLineItemValue('inventoryassignment', 'issueinventorynumber', 'working456');
                            //nlapiLogExecution("debug", "reached setCurrentLineItemValue ", '');
                            //subrecord2.selectNewLineItem('inventoryassignment');
                            //nlapiLogExecution("debug", "reached inventoryassignment ", '');
                            //subrecord2.setCurrentLineItemValue('inventoryassignment', 'issueinventorynumber',//   '2ndlineinventorynumber');
                            subrecord2.setCurrentLineItemValue('inventoryassignment', 'quantity', itemKitCompQty); //7
                            subrecord2.setCurrentLineItemValue('inventoryassignment', 'binnumber', binToAssign); // '4159'
                            //nlapiLogExecution("debug", "reached before commitLineItem ", '');
                            subrecord2.commitLineItem('inventoryassignment');
                            //nlapiLogExecution("debug", "reached before subrecord2 ", '');

                            subrecord2.commit();
                            //nlapiLogExecution("debug", "reached before commitLineItem ", '');

                            record2.commitLineItem('item');
                            //nlapiLogExecution("debug", "reached before record2 commit ", '');
                        }
                    }

                    if (itemType == 'Group') {
                        //nlapiLogExecution("debug", "Item is group ", '');

                        isGroup = 'T';

                        revrecstartdate = record2.getCurrentLineItemValue('item', 'revrecstartdate');
                        revrecenddate = record2.getCurrentLineItemValue('item', 'revrecenddate');
                        kitComponents = record2.getCurrentLineItemValue('item', 'custcol_mb_bin_information'); //giftcertmessage  custcol_mb_kit_information
                        //nlapiLogExecution("debug", "binInfo AS IS ", kitComponents);
                        var kitBinIndex = kitComponents.toLowerCase().indexOf("~");
                        var kitBinLength = kitComponents.length;
                        if (kitBinIndex >= 0) {
                            record2.setCurrentLineItemValue('item', 'custcol_mb_bin_information', kitComponents.substring(0, kitBinIndex)); //kitBinIndex- 1
                            //nlapiLogExecution("debug", "only binInfo now ", kitComponents.substring(0, kitBinIndex));
                            record2.commitLineItem('item');
                            kitComponents = kitComponents.substring(kitBinIndex + 1, kitBinLength); //- kitBinIndex
                        }
                        //nlapiLogExecution("debug", "kitBinIndex, kitBinLength, revrecstartdate, revrecenddate and kitComponents : ", kitBinIndex + '--' + kitBinLength + '--' +
                        //   kitComponents + '--' + revrecstartdate + '--' + revrecenddate);
                        arKitComponents = kitComponents.split("#");
                    }
                }
            }
            //var inv_Record_1 = nlapiLoadRecord('invoice', invRecordId);
            nlapiLogExecution("debug", " record invoice is getting committed again ", record2);
            invRecordId = nlapiSubmitRecord(record2); // Saves the record thereby adjusting to new TaxRate.		

        }
        if (dataIn['override_tax_rate'] == "TRUE") {
            nlapiLogExecution("debug", "override taxRate is  ", dataIn['override_tax_rate']);
            try {
                nlapiLogExecution("debug", "override taxRate dummy execution  ", "");
                //var inv_Record = nlapiLoadRecord('invoice', invRecordId);
                //invRecordId = nlapiSubmitRecord(inv_Record); // Saves the record thereby //adjusting to new TaxRate.
            }
            catch (ex) {
                var errMsg = errText(ex);
                nlapiLogExecution("error", "error in override tax rate", ex);
                return errObject(errMsg);
            }
        }
        return invRecordId;
    }
    catch (ex) {
        var errMsg = errText(ex);
        var invErr = "Error in Invoice :" + errMsg;
        nlapiLogExecution("error", "CreateInvoice has failed ", ex);
        return invErr;
    }
}


/**
 * @param {Object} dataIn Parameter object
 * @returns {Void}
 */
function deleteRESTlet(dataIn) {

}

/**
 * @param {Object} dataIn Parameter object
 * @returns {Object} Output object
 */

function putRESTlet(dataIn) {

    return {};
}

//return an error object for consumption be an external source.
function errObject(_e) {

    var err = new Object();
    err.error = _e;
    var errors = [err];
    return (errors);
}
//Take error and form it into a readable string and return it

function errText(_e) {
    _internalId = nlapiGetRecordId();
    if (!(typeof _internalId === 'number' && (_internalId % 1) === 0)) {
        _internalId = 0;
    }
    var txt = '';
    if (_e instanceof nlobjError) {
        // this is netsuite specific error
        txt = 'Netsuite API Error: Record ID :: ' + _internalId + ' :: ' + _e.getCode() + ' :: ' + _e.getDetails() + ' :: ' + _e.getStackTrace().join(', ');
    }
    else {
        // this is generic javascript error
        txt = 'JavaScript/Other Error: Record ID :: ' + _internalId + ' :: ' + _e.toString() + ' : ' + _e.stack;
    }
    return txt;
}


function getInternalId(recordType, id) {
    try {
        var entityName = recordType;
        var idField = "itemid";
        if (recordType == "customer") {
            idField = "entityid";
        }
        if (recordType == "salesorder") {
            idField = "tranid";
        }
        var filters = [new nlobjSearchFilter(idField, null, "is", id)];
        var columns = [new nlobjSearchColumn("internalid")];

        var searchResult = nlapiSearchRecord(entityName, null, filters, columns);
        if (searchResult) {
            return (searchResult[0].getValue("internalid"));
        }
        //nlapiLogExecution("debug", "Internal Id not found for " + recordType, id);
        return null;
    }
    catch (ex) {
        var errMsg = errText(ex);
        nlapiLogExecution("error", "get InternalId Failure", ex);
        return null;
    }
}


function getBinQty(itemId, itemLocation) {
    nlapiLogExecution('DEBUG', 'here 2-99 : itemId,itemLocation', itemId + ' --' + itemLocation);
    var binOnHand = 0;
    try {
        var filters = new Array();
        filters[filters.length] = new nlobjSearchFilter('internalidnumber', null, 'equalto', itemId);
        //filters[filters.length] = new nlobjSearchFilter('location', 'binonhand', 'anyof', itemLocation);

        var searchResults = nlapiSearchRecord(null, 'customsearch_mb_itemwise_location_qty', filters, null);

        if (searchResults) {
            //nlapiLogExecution("debug", "search results", JSON.stringify(searchResults));
            var cols = searchResults[0].getAllColumns();
            binOnHand = searchResults[0].getValue(cols[1]);
            nlapiLogExecution("debug", "first element", binOnHand);
        }
    }
    catch (e) {
        nlapiLogExecution("error", "suiteScript() has encountered an error in getBinQty", e);
    }
    return searchResults; //binOnHand;
}

function spacePad(num, places) {
    var zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
}

function pad(width, string, padding) {
    return (width <= string.length) ? string : pad(width, padding + string, padding)
}

function padSpace(value) //,padString
{
    pad = '            ';
    return (pad + value).slice(-pad.length)
}


function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    //nlapiLogExecution("debug", "within  customizeGlImpact ", "");

    var invoiceStatus = transactionRecord.getFieldValue("status"); //added aug 22,2019
    var entityId = transactionRecord.getFieldValue("entity");
    var tranDate = transactionRecord.getFieldValue("trandate");
    var invoiceMemo = transactionRecord.getFieldValue("memo");
    var invoiceId = transactionRecord.getFieldValue("internalid");  //transactionRecord.getId();
    var invoiceTranId = transactionRecord.getFieldValue("tranid");
    var invoiceAmount = transactionRecord.getFieldValue("total");
    var taxAmount = transactionRecord.getFieldValue("taxtotal");
    var calc_gp = transactionRecord.getFieldValue("custbody_mb_recalc_gp");
    var context = nlapiGetContext();
    var ref2 = transactionRecord.getFieldValue("custbody_mb_reference_2");

    ///
    //var currentContext = nlapiGetContext();   
    //if(currentContext.getExecutionContext() == 'csvimport' && type == 'create')
    ///
    //var IsGood = true;
    var memoFound = invoiceMemo.toLowerCase().indexOf('open');

    nlapiLogExecution("debug", "testing invoiceMemo , invoiceStatus,entity, memoFound ", invoiceTranId + '##' + invoiceId + '##' +
        invoiceMemo + '##' + entityId + '##' + memoFound + '##' + tranDate + '##' + calc_gp + '##' + context.getName() + '##' + context.getEmail() + '##' + context.getExecutionContext() + '##' + ref2);

    if (invoiceTranId == '') //not working.. Meant to check if recordMode is CREATE then always do InvFee calculations
        calc_gp = 'T';

    if (invoiceMemo.toLowerCase().indexOf('open') == 0 || invoiceAmount <= 0 || invoiceStatus == 'Paid In Full' || context.getExecutionContext() == 'mapreduce'(invoiceId != '' && context.getEmail().toLowerCase() != restLet_Email) || ref2 == 'custom_gl') { // Do not do CustomGL or fee calculation for historical invoices. || calc_gp == 'F'
        // mapreduce condition added to above if condition on added aug 22,2019
        nlapiLogExecution("debug", "invoice-customgl", "exiting as tranid has these detailsFound...testing invoiceMemo ", invoiceTranId + '##' +
            invoiceId + '##' + invoiceMemo + '##' + entityId + '##' + memoFound + '##' + tranDate + '##' + calc_gp + '##' + context.getName() + '##' + context.getEmail() + '##' + context.getExecutionContext());
        return; //IsGood = false;
    }
    invoiceAmount = invoiceAmount - taxAmount;

    //nlapiLogExecution("debug", "Found...Now next...testing invoiceMemo ", invoiceMemo);

    var invoiceFees = getFees(entityId, tranDate); //invoiceId
    if (invoiceFees != null && invoiceFees.length > 0) {
        //if (calc_gp ==  'T')
        //
        if (context.getExecutionContext() != 'csvimport') {
            //nlapiLogExecution("debug", "getInvFees entering ", context.getExecutionContext());              
            getInvFees(invoiceTranId);
        }

        for (var j = 0; j < invoiceFees.length; j++) {
            //var rcdFeeInfo = nlapiLoadRecord("customrecord_mb_cash_distribution_setup", invoiceFees[j].getValue("custrecord_mb_fee_id"));
            //if (rcdFeeInfo)
            {
                var accountDebit = invoiceFees[j].getValue("custrecord_mb_setup_dist_gl_debit"); // rcdFeeInfo.getFieldValue("custrecord_mb_setup_dist_gl_debit");
                var accountCredit = invoiceFees[j].getValue("custrecord_mb_setup_dist_gl_credit"); //rcdFeeInfo.getFieldValue("custrecord_mb_setup_dist_gl_credit");
                var type_Fee = invoiceFees[j].getValue("custrecord_mb_setup_dist_linefee_memo"); //rcdFeeInfo.getFieldValue("custrecord_mb_setup_dist_gl_credit");
                var memo = invoiceFees[j].getValue("name"); // invoiceFees[j].getValue("custrecord_mb_setup_dist_fee");
                var fee_Factor = invoiceFees[j].getValue("custrecord_mb_setup_dist_line_fee_factor");
                var fee_internalId = invoiceFees[j].getValue("internalid");

                //nlapiLogExecution("debug", "Restlet invoice GLImpact. invoiceAmount", invoiceAmount + '--' + type_Fee);

                var factor = 0;
                var factor = parseFloat(fee_Factor);

                /*
                switch (type_Fee.toLowerCase()) {
                    case 'freightload':
                        factor = 6; //read it from the setup.
                        break;
                    case 'returnallowance':
                        factor = 1;
                        break;
                     default:
                         nlapiLogExecution("debug", "Restlet invoice GLImpact. Wrong typeFee", type_Fee);
                         break;
                }*/

                //var feeFound = -1;
                //feeFound = type_Fee.toLowerCase().indexOf('freight');
                //nlapiLogExecution("DEBUG", "account", accountCredit + '--' + feeFound);

                if (factor != 0) {
                    var amount = parseFloat((invoiceAmount * factor) / 100);
                    //nlapiLogExecution("DEBUG", "amount of fee is ", amount);

                    //var memo = "Pramod testing " + invoiceAmount; //rcdFeeInfo.getFieldValue("custrecord_mb_setup_dist_linefee_memo");
                    //nlapiLogExecution("DEBUG", "memo", memo);


                    // add new line
                    if (emptyIfNull(accountDebit) != "") {

                        var newLine = customLines.addNewLine();
                        newLine.setEntityId(parseInt(entityId));
                        newLine.setDebitAmount(amount);
                        newLine.setAccountId(parseInt(accountDebit));
                        newLine.setMemo(memo);
                    }
                    if (emptyIfNull(accountCredit) != "") {

                        var newLine = customLines.addNewLine();
                        newLine.setEntityId(parseInt(entityId));
                        newLine.setCreditAmount(amount);
                        newLine.setAccountId(parseInt(accountCredit));
                        newLine.setMemo(memo);
                    }

                    //if (calc_gp == 'T')
                    if (context.getExecutionContext() != 'csvimport') {
                        buildInvoiceFeeData(invoiceId, fee_internalId, amount, accountDebit, accountCredit, invoiceTranId, fee_Factor);
                    }
                }
            }
        }
    }
    //transactionRecord.setFieldValue("custbody_mb_recalc_gp",'F');
}


function buildInvoiceFeeData(invoiceId, fee_internalId, feeAmount, accountDebit, accountCredit, invoiceTranID, fee_Factor) {
    try {
        //return;

        var context = nlapiGetContext();
        // pass the recalc Fee field.
        // if it is ticked and if there are entries in invoiceFeeSubList for this invoice, then delete it. If not ticked and if entries exist in invoiceFeeSublist, simply return. 
        //If entries do not exist in invfeelist, then create them.

        //nlapiLogExecution("debug", "buildInvoiceFeeData : ", invoiceId+'##'+invoiceTranID);
        var recObj_invoiceFee = nlapiCreateRecord('customrecord_mb_invoice_fees');
        recObj_invoiceFee.setFieldValue('custrecord_mb_fee_id', fee_internalId);
        recObj_invoiceFee.setFieldValue('custrecord_mb_fee_amount', feeAmount);
        recObj_invoiceFee.setFieldValue('custrecord_mb_fees_debit_account', accountDebit);
        recObj_invoiceFee.setFieldValue('custrecord_mb_fees_credit_account', accountCredit);
        recObj_invoiceFee.setFieldValue('custrecord_mb_fee_percent', fee_Factor);
        recObj_invoiceFee.setFieldValue('custrecord_mb_invoice_fee_actual', 'F');
        recObj_invoiceFee.setFieldValue('custrecord_mb_invoice_id', invoiceId);
        recObj_invoiceFee.setFieldValue('custrecord_mb_invoice_tranid', invoiceTranID);
        var invoiceFee_internalId = nlapiSubmitRecord(recObj_invoiceFee, true, true);

    }
    catch (e) {
        nlapiLogExecution("error", "suiteScript() has encountered an error in buildInvoiceFeeData ", e);
    }
}

function getFees(entityId, tranDate) {
    //return;
    var filters = [new nlobjSearchFilter("custrecord_mb_setup_dist_customer", null, "anyof", entityId),
    new nlobjSearchFilter("custrecord_mb_setup_dist_linefee_txn_typ", null, "anyof", '7'), //null, "is", 'invoice')
    new nlobjSearchFilter("isinactive", null, "is", 'F'),
    new nlobjSearchFilter("custrecord_mb_setup_dist_fee_expire_date", null, "onorafter", tranDate),
    new nlobjSearchFilter("custrecord_mb_setup_dist_fee_begin_date", null, "onorbefore", tranDate)


        //new nlobjSearchFilter("purchasedate", null, "anyof", '7') //null, "is", 'invoice')
        //filters[0] = new nlobjSearchFilter( 'purchasedate', null, 'on','today'); 
    ];

    //new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", invoiceId)
    var columns = [
        new nlobjSearchColumn("custrecord_mb_setup_dist_gl_credit", null, null),
        new nlobjSearchColumn("custrecord_mb_setup_dist_gl_debit", null, null),
        new nlobjSearchColumn("custrecord_mb_setup_dist_fee", null, null),
        new nlobjSearchColumn("custrecord_mb_setup_dist_linefee_memo", null, null),
        new nlobjSearchColumn("name", null, null),
        new nlobjSearchColumn("custrecord_mb_setup_dist_line_fee_factor", null, null),
        new nlobjSearchColumn("internalid", null, null),
        new nlobjSearchColumn("custrecord_mb_setup_dist_linefee_txn_typ", null, null)

        //new nlobjSearchColumn("custrecord_mb_fee_amount", null, null)
    ];
    //nlapiLogExecution("DEBUG", "trying getFees ", entityId);

    searchResults = nlapiSearchRecord("customrecord_mb_cash_distribution_setup", null, filters, columns); //customrecord_mb_invoice_fees

    if (searchResults) {
        return (searchResults)
    }
    return null;
}

function emptyIfNull(val) { return val == null ? "" : val; }

function parseFloatOrZero(val) {
    return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}

function getInvFees(invoiceTranId) {

    //return; // uncomment this when it is ready to delete
    try {
        //var invoiceTranId = '2011_1574289';
        var filters = [
            //new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", invoiceId) // "@NONE@")
            new nlobjSearchFilter("custrecord_mb_invoice_tranid", null, "is", invoiceTranId)
        ];
        // nlapiLogExecution("debug", "entered getInvFees  ", invoiceTranId);

        var columns = [
            new nlobjSearchColumn("custrecord_mb_invoice_tranid", null, null),
            new nlobjSearchColumn("internalid", null, null),
            new nlobjSearchColumn("custrecord_mb_invoice_fee_actual", null, null)
        ];

        searchResults = nlapiSearchRecord("customrecord_mb_invoice_fees", null, filters, columns);
        //nlapiLogExecution("DEBUG", "trying getInvFees ", "just got searchResults");
        if (searchResults) {
            //nlapiLogExecution("DEBUG", "trying getInvFees ", "after searchResults");

            for (var feeInvIndex = 0; feeInvIndex < searchResults.length; feeInvIndex++) {
                {
                    try {
                        var invFeeRec_InternalId = searchResults[feeInvIndex].getValue("internalid");
                        var FeeActual = searchResults[feeInvIndex].getValue("custrecord_mb_invoice_fee_actual");

                        if (FeeActual == 'F') {
                            //nlapiLogExecution("DEBUG", "nlapiDeleteRecord done ", invFeeRec_InternalId + '##' + FeeActual);
                            nlapiDeleteRecord('customrecord_mb_invoice_fees', invFeeRec_InternalId);
                        }

                    }
                    catch (e) {
                        nlapiLogExecution("error", "suiteScript() has encountered an error in deleting invoiceFee record ", e);
                    }
                }
            }
        }
    }
    catch (e) {
        nlapiLogExecution("error", "suiteScript() has encountered an error in getInvFees ", e);
    }
}