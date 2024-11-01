	/**
	 * Module Description
	 * Version            - 1.0
	 * Script Type        - ScheduleScript
	 * Description        - Import IC
	 * Author             - Mibar
	 */

	var MINIMUM_USAGE = 1000;
	function importIC_Data(type) {
		try
		{
			nlapiLogExecution('debug', 'here 1 ', type);		
			var arrLines = nlapiLoadFile(47322).getValue().split(/\n|\n\r/); //15550  
			nlapiLogExecution('debug', 'here 2 ', arrLines);

			var recId  ='';
			var lFirst = true;
			var from_subsidiary = ''; 
			var to_subisidiary = '';  
			var from_location = '';
			var to_location  = ''; 
			var tranDate = '';  
			var item_name = ''; 
			var item_qty = '';
			var item_price = '';
			var item_transfer_price= '';
			var interCoTransfer;
			var batchId = '';
			var shipworks_orderId='';
			var binInformation = '';
			
			var itemCount = 0;
			for (var i = 1; i < arrLines.length-1; i++) { // i < arrLines.length-1; //i is 1 to skip header row
				
				if (nlapiGetContext().getRemainingUsage() <= MINIMUM_USAGE)
				{
					nlapiLogExecution('AUDIT', 'Scheduled Script', 'Not enough usage left('
							+ nlapiGetContext().getRemainingUsage()
							+ ') . Exiting and rescheduling script.');
					setRecoveryPoint();
					checkGovernance();
				}
				
				try
				{
					//var arrLineContent = arrLines[i].replace(",","_");
					var content = arrLines[i].split(',');
					itemCount++;
					item_name = '';
					//if (content[0] != 'undefined')
						{
					if (lFirst)
					{
    					nlapiLogExecution('debug', 'here 2 : arrLines length ' + content[0], arrLines.length);
						lFirst=false;
						nlapiLogExecution('debug', 'here 3 ', content);
						from_subsidiary =  content[16]; //'18' //
						to_subisidiary = content[0];  '21'; '14'; //
						from_location = content[9];
						to_location  = content[1];
						tranDate = '10/16/2020'; // '11/20/2018'; //'06/21/2018'; //'01/04/2019'; //content[3]; '06/21/2018';  //
						batchId =content[10];
						interCoTransfer = nlapiCreateRecord('intercompanytransferorder', true);

						nlapiLogExecution('debug', 'entered script-01.4', 'batchId is '+batchId);
						
						interCoTransfer.setFieldValue('orderstatus', 'B'); //to pending fulfilment
						interCoTransfer.setFieldValue('subsidiary', from_subsidiary);
						interCoTransfer.setFieldValue('tosubsidiary', to_subisidiary);
						interCoTransfer.setFieldValue('location', from_location);
						interCoTransfer.setFieldValue('transferlocation', to_location);
						interCoTransfer.setFieldValue('incoterm', '1'); //DAP
						interCoTransfer.setFieldValue('trandate', tranDate);
						interCoTransfer.setFieldValue('useitemcostastransfercost', 'F'); //'T' //used T for Sep 14th
						nlapiLogExecution('debug', 'entered script-01.5', 'content 0,6,9,14,16 is ' + content[0] + '@@'+content[6] + '@@'+content[9]+ '@@'+content[14]+ '@@'+content[16]);
					}
					item_name = content[6]; //'93688';
					
					item_qty = parseFloatOrZero(content[4]);
					item_price = parseFloatOrZero(content[7]);				
					item_transfer_price  = parseFloatOrZero(content[14]);
					shipworks_orderId = content[2];
					binInformation				 = content[11];
					
					if ((item_transfer_price !=item_price)) // && (item_name == '125204'))
                      {
						nlapiLogExecution('debug', 'item_price <> item_transfer_price',  item_transfer_price+ '@@'+item_price);
						item_price =item_transfer_price;
                      }
					nlapiLogExecution('debug', 'script-01.6', item_name+'##'+item_qty+'##'+item_price +'##'+from_subsidiary +'##'+to_subisidiary +'##'+from_location +'##'+to_location);
					  
					///
					if (item_name == '125204')
                      {
						
						nlapiLogExecution('debug', 'contents upto 6', content[0]+'##'+content[1]+'##'+content[2]+'##'+content[3] +'##'+content[4] +'##'+content[5] +'##'+content[6]);
						nlapiLogExecution('debug', 'contents from 7', content[7] +'##'+content[8] +'##'+content[9] +'##'+content[10] );
						nlapiLogExecution('debug', 'contents from 10', content[11] +'##'+content[12] +'##'+content[13] +'##'+content[14]);
					  }
					
					interCoTransfer.selectNewLineItem('item');
					interCoTransfer.setCurrentLineItemValue('item', 'item', item_name);
					interCoTransfer.setCurrentLineItemValue('item', 'rate', item_price);
					interCoTransfer.setCurrentLineItemValue('item','quantity', item_qty);
					interCoTransfer.setCurrentLineItemValue('item','quantitycommitted', item_qty);
					interCoTransfer.setCurrentLineItemValue('item','custcol_mb_kit_information', shipworks_orderId);
					interCoTransfer.setCurrentLineItemValue('item','custcol_mb_bin_information', binInformation);

					//interCoTransfer.setCurrentLineItemValue('item','commitinventory', 'T');

					interCoTransfer.commitLineItem('item');
					//nlapiLogExecution('debug', 'entered script-02', item_name);

					//if (i == (arrLines.length)-1)
					//{
					//	nlapiLogExecution('debug', 'entered script-02', i + '**'+(arrLines.length));
					//	recId         ='';
					//	recId=nlapiSubmitRecord(interCoTransfer, true, true);
					//	nlapiLogExecution('audit','IC record created :',recId);
					//}
						}
				}
				
				catch(e){
					nlapiLogExecution('debug', 'Error created during IC import -inner loop:', e);
					continue;
				}
			}
			{
				nlapiLogExecution('debug', 'entered script-ABOUT TO SUBMIT','');
				recId ='';
				interCoTransfer.setFieldValue('memo', batchId + ' (Total items : '+itemCount +')');
				interCoTransfer.setFieldValue('tranid', batchId); //to pending fulfilment
				
				recId=nlapiSubmitRecord(interCoTransfer, true, true);
				//nlapiLogExecution('debug','IC record created :',recId);
				
				/*
				record.transform({
				   fromType:'intercompanytransferorder',
				   fromId: recId,
				   toType: 'itemfulfillment',
				   //defaultValues: {
				   //billdate: '01/01/2019'} 
				   }				   );
				*/
				   
				nlapiLogExecution('debug', 'About to start item Fulfilment transform','');

				var ifRec = nlapiTransformRecord('intercompanytransferorder', recId, 'itemfulfillment');				   
				ifRec.setFieldValue('shipstatus', 'C'); //shipped
				ifRec.setFieldValue('trandate',tranDate); 
				ifRec.setFieldValue('memo', batchId + ' (Total items : '+itemCount +')');
				var ifID = nlapiSubmitRecord(ifRec);	
				nlapiLogExecution('debug', 'About to start item receipt','');

				var irRec = nlapiTransformRecord('intercompanytransferorder', recId, 'itemreceipt');				   
				irRec.setFieldValue('trandate',tranDate); 
				irRec.setFieldValue('memo', batchId + ' (Total items : '+itemCount +')');
				var irID = nlapiSubmitRecord(irRec);	
				nlapiLogExecution('debug', 'Completed item receipt','');

			 	//var fileDeleted = nlapiDeleteFile(47322); //23826
				//nlapiLogExecution('debug', 'File deleted : ',fileDeleted);
			}
		}
		catch(e){
					nlapiLogExecution('debug', 'Error created during IC import -outer loop:', e);
				}
	}

	function setRecoveryPoint() {
		var state = nlapiSetRecoveryPoint();
		if (state.status == 'SUCCESS')
			return; 
		
		if (state.status == 'RESUME') 
		{
			nlapiLogExecution("ERROR", "Resuming script because of " + state.reason
					+ ".  Size = " + state.size);
			return;
		} else if (state.status == 'FAILURE') 
		{
			nlapiLogExecution("ERROR", "Failed to create recovery point. Reason = "
					+ state.reason + " / Size = " + state.size);
		}
	}

	function emptyIfNull(val) { return val == null ? "" : val; }

	function parseFloatOrZero(val) {
		return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
	}

	function checkGovernance() {
		var context = nlapiGetContext();
		if (context.getRemainingUsage() < MINIMUM_USAGE) {
			var state = nlapiYieldScript();
			if (state.status == 'FAILURE') {
				nlapiLogExecution("ERROR",
						"Failed to yield script, exiting: Reason = " + state.reason
						+ " / Size = " + state.size);
				throw "Failed to yield script";
			}
		}
	}