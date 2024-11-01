/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
*/

const maxColumnsInCSV=11;
const AdjCostDecimalRound=5; //5
const searchId = 'customsearch_mb_kit_invadj_created_today'; 
const scr5025Suffix = "SCR_Kit5025";
const folderId = 763; //740;
const csvFileName = 'Fix_5025Kit.csv';
const csvFileDescription = 'Fix 5025 KIT invadj';
const csvFileName_skipped = 'Fix_5025Kit_skipped.csv';
const csvFileDescription_skipped = 'Fix 5025 KIT invadj_Skipped';
const savedCsvId= 497; 
const urlFileCabinet ='https://4668299.app.netsuite.com/core/media/media.nl?id=49394&c=4668299&h=6NykqkNwsWPIyzlA2rKrsABFQDwIrplpSu2XplurwiLgHdjD&_xt=.csv'
const urlFile = 'https://4668299.app.netsuite.com/app/common/media/mediaitem.nl?id=49394'
const savedSearchLink = 'https://4668299.app.netsuite.com/app/common/search/searchresults.nl?searchid=1394&saverun=T&whence=';
const csvJobStatusLink = 'https://4668299.app.netsuite.com/app/setup/upload/csv/csvstatus.nl?whence=';
const emailSender ='17';
const recips = ["pramod@mibar.net"];
//const recips = ["Netsuite@mibar.net,min@hudsonenvelope.com"];
const email_subj = "Kit InvAdj script has generated NEW file.";
const email_msg = "Fyi, You should review the csv file. Download using below link  \n \n"+urlFileCabinet+"\n \n";
const CSV_IMPORT_msg = "Also, check status of CSV import using below link \n \n"+csvJobStatusLink+"\n \n";

const MINIMUM_USAGE = 300;
var startDateTime = new Date();
const unIdentified_lineId = -99;
//const executionThreshold  = 40; //pull from general_Preferences
		  
define(['N/search', 'N/record','N/email','N/file','N/runtime','N/task'],
	function (search,record,email,file,runtime,task){
		function execute(context){
			var mySearch = search.load({
			  id: searchId
			 });
			executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
			//log.debug('mySearch', mySearch);
			var headers = new Array();
			var columns = mySearch.columns;
			var arr_data_from_column = new Array();
			var arr_adjCostToPush= new Array();
			var nSavedSearchRows = 0;
			var content = new Array();
			var cells = new Array();
			var arr_invAdj_Header = new Array();
			var columnName = '';
			
			processAll_Lines = runtime.getCurrentScript().getParameter({name: 'custscript_mb_5025kit_consume_all_lines'});
			email5025KitResults = runtime.getCurrentScript().getParameter({name: 'custscript_mb_5025kit_process_email'});
			processCSV= runtime.getCurrentScript().getParameter({name: 'custscript_mb_5025kit_process_file'});						
					//nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_5025kit_process_file');//process File.
			log.debug('processCSV', processCSV);
					
			for(var i=0; i< columns.length; i++){
				switch (i) {
				 case 4:
					columnName = 'Linked Invoice';
					break;
				 case 5:
					columnName = 'Adj Type';
					break;
				 case 6:
					columnName = 'Process';
					break;
				 case 7:
					columnName = 'Linked Invoice Line';
					break;
				 case 13:
					columnName = 'Line Amount';
					break;
				 default:
					columnName = columns[i].name;
					break;
				}
				
			  headers[i] = columnName;
			  //log.debug('col ',columnName + ' AND column Index is '+ i);
	 		}
		    log.debug('Headers is ',headers);
			
			//content[nSavedSearchRows] =  headers; //UnComment this later...
			//nSavedSearchRows =1; ////UnComment this later...
			nSavedSearchRows =0; ////Comment this later...
		
			var searchResults = mySearch.run();                    //Execute Search.
			if (searchResults) {
				var srchIdx = 0; var goodCount = 0; var badCount = 0; var testCount = 0;
				var getOut = false;
				var Last_InvoiceNr=''; var Last_invadj_tranid = ''; var invAdjItem = ''; 
				var invoiceNr='';  var processLine = '';  var adjType = ''; var skipInvadj='N'; var invadj_tranid=''; var lineMemo = '';
				var invoiceLine = 0; var itemRate_Increase =0;  var lineAmount = 0; var lineAmount_Header = -99999; var invAdjLine = 0; var invAdjQty=0;
  			    var build_invadj_details ='';			
				
				do {
					var resultSlc = searchResults.getRange({
						start : srchIdx,
						end : srchIdx + 1000
					});        //Retrieve results in 1000-row slices.

					for (var i in resultSlc) {    //Step through the result rows.
						for(var y=0; y< columns.length; y++){

						  var searchResult = resultSlc[i].getValue(resultSlc[i].columns[y]);
							//var searchResult = resultSlc[i].getValue(
							//{
							// name: columns[y].name
							//});
						  // new logic starts here
						  switch (y) {
							case 1:
								invadj_tranid = 	searchResult;
								break;
							case 4:
							  //log.debug('col within resultSlc and Y is : ',searchResult + ' Y is '+ y);
							  searchResult = searchResult.replace(/[^0-9_-]/g, ''); //remove all except numbers and hyphen.
							  //log.debug('col within resultSlc and Y is : ',searchResult + ' Y NOW is '+ y);
								invoiceNr = 	searchResult;
								break;
							case 5:
								adjType = searchResult;
								break;
							case 6:
								processLine = searchResult;
								break;
							case 7:
								invoiceLine = searchResult;
								break;
							case 8:
								lineAmount = parseFloatOrZero(searchResult);
								break;
							case 9:
								invAdjLine = parseFloatOrZero(searchResult);
								break;
							case 22: //10:
								invAdjItem = searchResult;
								break;
							case 11:
								invAdjQty =Math.abs(parseFloatOrZero(searchResult));
								break;
							case 12:
								invAdjRate = parseFloatOrZero(searchResult);
								break;
							case 19:
								lineMemo =searchResult;
								break;
							default:
								searchResult = '';
								break;
							}
						}
						var existing_line_to_remove = -1;
						var existing_reduce_lineAmt = 0;
						var existing_Increase_adjLineID = 0;
						var existing_Increase_AdjQty = 0;	
						var existing_Increase_AdjRate = 0;	
						var existing_header_LineAmount = -99999;
						var existing_header_invAdjItem = '';
						var existing_header_Increase_lineMemo = '';
						var existing_header_memo = '';
						
						// Find if the invoiceLineNr already exists.						
						//if (lineAmount == 0 && invAdjLine == 0)
						//{
						//	lineAmount_Header = 0;
						//}
						
						if (invAdjLine == 0)
						{
							lineAmount_Header = lineAmount;
							var header_obj = {
								'invadj_tranid': invadj_tranid,
								'header_LineAmount' : lineAmount_Header,
									'header_memo' :lineMemo
							};
							
							arr_invAdj_Header.push(header_obj);
						}
						else
						{
							lineAmount = Math.abs(lineAmount);
							
							var invoiceLineNr = invoiceNr+"~"+invoiceLine;

							for (h=0;h<arr_invAdj_Header.length;h++){
								var line_hdr = arr_invAdj_Header[h];
								var invAdjTranId = line_hdr.invadj_tranid;
								if (invAdjTranId == invadj_tranid){
									existing_header_LineAmount = parseFloatOrZero(line_hdr.header_LineAmount);
									existing_header_memo = line_hdr.header_memo;									
									break;
								}
							}
							
							for (m=0;m<content.length;m++){
								
								var line = content[m];
								var invLineNr = line.invoiceLineNr;
								log.debug('invLineNr and invoiceLineNr within m loop : ',invLineNr + '##' +invoiceLineNr + '##' + m+ '##' + invAdjLine +'##' +lineMemo);
								
								if (invLineNr == invoiceLineNr){
									// Load important values.
									existing_line_to_remove = parseFloatOrZero(m);
									existing_reduce_lineAmt = parseFloatOrZero(line.reduce_lineAmt);
									existing_Increase_adjLineID = parseFloatOrZero(line.Increase_adjLineID);
									existing_Increase_AdjQty = parseFloatOrZero(line.Increase_AdjQty);	
									existing_Increase_AdjRate= parseFloatOrZero(line.Increase_AdjRate);
									existing_header_LineAmount = parseFloatOrZero(line.header_LineAmount);
									existing_header_invAdjItem = line.invAdjItem;
									existing_header_Increase_lineMemo = line.Increase_lineMemo;
									
									log.debug('invLineNr found in m loop : ',invoiceLineNr + '##'+adjType+'##'+m+'##'+
										existing_line_to_remove + '##' +
										existing_reduce_lineAmt  + '##' +
										existing_Increase_adjLineID + '##' +
										existing_Increase_AdjQty +	 '##' +
										existing_Increase_AdjRate +	 '##' +
										existing_header_LineAmount + '##' +
										existing_header_invAdjItem + '##' +
										existing_header_Increase_lineMemo 								
									);								
									break;
								}								
							}
							if (existing_line_to_remove >=0)
							{
								content.splice(existing_line_to_remove, 1); //content.splice(content.indexOf(existing_line_to_remove), 1);
								//nSavedSearchRows--;  
								log.debug('invLineNr found and removed  : length now is ',existing_line_to_remove + '##'+content.length);								
							}
							else
							{
								log.debug('invLineNr NOT found and NOT removed and current content length is : ',
								content.length	 + '##' + 
								existing_line_to_remove + '##' +
								existing_reduce_lineAmt  + '##' +
								existing_Increase_adjLineID + '##' +
								existing_Increase_AdjQty +	 '##' +
								existing_Increase_AdjRate +	 '##' +
								existing_header_LineAmount + '##' +
								existing_header_invAdjItem + '##' +
								existing_header_Increase_lineMemo + '##' +
								existing_header_memo );
							}
							
							var reduce_lineAmt =  adjType.search('Reduce')== -1 ? existing_reduce_lineAmt : existing_reduce_lineAmt+Math.abs(lineAmount);
							var Increase_adjLineID=  adjType.search('Reduce')== -1 ? invAdjLine : existing_Increase_adjLineID;
							var Increase_AdjQty=  adjType.search('Reduce')== -1 ? invAdjQty : existing_Increase_AdjQty;
							var invAdjRate=  adjType.search('Reduce')== -1 ? invAdjRate : existing_Increase_AdjRate;
							var Increase_lineMemo = adjType.search('Reduce')== -1 ? lineMemo : existing_header_Increase_lineMemo;
							var header_LineAmount = existing_header_LineAmount == -99999 ? lineAmount_Header : existing_header_LineAmount;
							var Increase_invadjItem = adjType.search('Reduce')== -1 ? invAdjItem :  existing_header_invAdjItem;
							
							Increase_lineMemo=Increase_lineMemo.replace(scr5025Suffix,"");
							//var	Increase_adjRate =  // Reduce_LineAmount / Increase_AdjQty
							log.debug('reduce_lineAmt, Increase_adjLineID, Increase_AdjQty, invAdjRate, Increase_lineMemo, header_LineAmount,Increase_invadjItem : ',
							reduce_lineAmt + '##' +Increase_adjLineID  + '##' +Increase_AdjQty  + '##' +invAdjRate  + '##' +Increase_lineMemo  + '##' +header_LineAmount  + '##' +Increase_invadjItem);								
												  
							//if (skipInvadj=='N')
							{
								var obj = {
									'invadj_tranid':  (invadj_tranid),
									'invoiceNr': invoiceNr,
									'invoiceLineNr' : invoiceLineNr,
									'reduce_lineAmt' : parseFloatOrZero(reduce_lineAmt),
									'Increase_adjLineID' : parseFloatOrZero(Increase_adjLineID),
									'Increase_AdjQty' : parseFloatOrZero(Increase_AdjQty),
									'Increase_AdjRate' : parseFloatOrZero(invAdjRate),											
									'Increase_lineMemo' : Increase_lineMemo.replace(scr5025Suffix,""),
									'header_LineAmount' : parseFloatOrZero(header_LineAmount),
									'invAdjItem':Increase_invadjItem 
								};
								
								content.push(obj);

								//content[nSavedSearchRows] += {invadj_tranid: invadj_tranid, invoiceNr : invoiceNr, invoiceLineNr: invoiceLineNr, 
								//reduce_lineAmt : reduce_lineAmt,
								//Increase_adjLineID : Increase_adjLineID, Increase_AdjQty : Increase_AdjQty, Increase_lineMemo : Increase_lineMemo,
								//header_LineAmount : header_LineAmount, invAdjItem : invAdjItem

								//nSavedSearchRows++;  
								log.debug('Pushed new obj creation : ',invoiceLineNr + '##'+reduce_lineAmt +'##'+content.length);
							}
							srchIdx++;

							if(executionTimesUp()){
								log.audit("Time limit error ","Validation has been rescheduled to avoid a script timeout");
								getOut = true; break;
							}
							var scriptObj = runtime.getCurrentScript();
							//log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());

							if(scriptObj.getRemainingUsage() < MINIMUM_USAGE){
								log.audit("Rescheduled","Validation has been rescheduled to avoid a script usage error");
								getOut = true; break;
							}
						} // else ends due to lineAmount_Header
					}
				} while (resultSlc.length >= 1000);
			}
			log.debug('content prepped is ',content);

			try {
			    //Creating a string variable that will be used as CSV Content
				var new_headers = new Array();
				var new_columns = mySearch.columns;
				var bFirstTime = true;

				var new_nSavedSearchRows = 0;
				var new_content = new Array();
				var new_cells = new Array();
				var new_columnName = '';
				for(var i=0; i<=maxColumnsInCSV; i++){ //Maximum columns is 11
					switch (i) {
					 case 0:
						new_columnName = 'Process?';						
						break;
					 case 1:
						new_columnName = 'InvoiceNr';
						break;
					 case 2:
						new_columnName = 'InvoiceLineNr';
						break;
					 case 3:
						new_columnName = 'Reduce_LineAmt';
						break;
					 case 4:
						new_columnName = 'Increase_adjLineID';
						break;
					 case 5:
						new_columnName = 'Increase_AdjQty';
						break;
					 case 6:
						new_columnName = 'Increase_AdjRate';
						break;
					 case 7:
						new_columnName = 'Increase_LineMemo';
						break;
					 case 8:
						new_columnName = 'Header_LineAmount';
						break;
					 case 9:
						new_columnName = 'Increase_InvAdjItem';
						break;
					 case 10:
						new_columnName = 'Invadj_tranid';						
						break;
					 case 11:
						new_columnName = 'Current_AdjRate_Increase';						
						break;
					 default:
						new_columnName = '';
						break;
					}
					new_headers[i] = new_columnName;
				}
	
				log.debug('New Headers is ',new_headers);
			  
				//parse content and also prepare header properly and fit into CSV File. Multiple CSV files may be required.
				for (m=0;m<content.length;m++){
					
					var arr_data_from_column = new Array();
					var line_contents = content[m];
					var invLineNr = line_contents.invoiceLineNr;
					var processLine = "YES";
					var IncreaseAdjCost =  roundVal(parseFloatOrZero(line_contents.reduce_lineAmt / line_contents.Increase_AdjQty),AdjCostDecimalRound);

					if ((roundVal(IncreaseAdjCost,2) == roundVal(line_contents.Increase_AdjRate,2))  
						//|| (IncreaseAdjCost - line_contents.Increase_AdjRate <= 0.1)
						//|| (line_contents.Increase_AdjRate-IncreaseAdjCost <= 0.1)
						)
						
						{
						processLine = "NO";
						log.audit("here and processLine",processLine + "#" + IncreaseAdjCost + "##"+line_contents.Increase_AdjRate);
						}
					
					if (line_contents.header_LineAmount ==0)
						processLine = "ZERO";
					
					log.audit("here and processLine",processLine + "#" + IncreaseAdjCost + "##"+line_contents.Increase_AdjRate+"##"+line_contents.header_LineAmount);

					//if ((processLine == "YES") || (processLine == "NO" && (processAll_Lines =='T' || processAll_Lines==true)))	
					{
						//bFirstTime = bFirstTime== false ? true : false;
						if (bFirstTime==true)
						{
							new_content[new_nSavedSearchRows] =  new_headers;
							new_nSavedSearchRows =1;	
							log.audit("bFirstTime is and new_headers length is ",bFirstTime + new_headers.length);
							bFirstTime= false;							
						}
						
						arr_data_from_column[0]=	processLine; //line_contents.invadj_tranid.replace(/[^0-9_-]/g, '');
						arr_data_from_column[1]=	line_contents.invoiceNr.replace(/[^0-9_-]/g, '');
						arr_data_from_column[2]=	line_contents.invoiceLineNr;
						arr_data_from_column[3]=	line_contents.reduce_lineAmt;
						arr_data_from_column[4]=	line_contents.Increase_adjLineID;
						arr_data_from_column[5]=	line_contents.Increase_AdjQty;
						arr_data_from_column[6]=	IncreaseAdjCost;  //
						arr_data_from_column[7]=	line_contents.Increase_lineMemo.replace(","," ")+" " +scr5025Suffix;
						arr_data_from_column[8]=	line_contents.header_LineAmount;
						arr_data_from_column[9]=	line_contents.invAdjItem;
						arr_data_from_column[10]=	line_contents.invadj_tranid.replace(/[^0-9_-]/g, '');
						arr_data_from_column[11]=	line_contents.Increase_AdjRate;
						
						new_content[new_nSavedSearchRows] +=arr_data_from_column;
						new_nSavedSearchRows++; 
					}											
				} 
			    //
				
				var contents='';
				var contents_skipped='';
				//log.debug('content length is ',new_content);
				for(var z =0; z<new_content.length;z++)
				{
				   /*	
				   //log.audit("prep contens from new_contens..Start Z is ",z);
				   if (z ==24995 || z ==49990 || z ==74985)
				   {
						log.debug('contents count is ','24995 || z ==49990 || z ==74985');
						createFile(z,contents)
						contents=new_headers + '\n';
				   }
				   */
				   //log.debug('new_content[z] index is ',new_content[z].toString().indexOf("undefinedNO"));
				   if (new_content[z].toString().indexOf("undefinedNO") < 0)
					   contents +=new_content[z].toString() + '\n';
				   else
				   {
					   if (processAll_Lines =='F' || processAll_Lines==false)
					   {
						   contents_skipped +=new_content[z].toString() + '\n';				   
						   log.debug('contents_skipped length is ',contents_skipped.length);
					   }
					   else
					   {
							contents +=new_content[z].toString() + '\n';
					   }
				   }
				}

				if (contents != new_headers + '\n')
				{
					log.debug('contents count is ',new_content.length);
					if (new_content.length >=1)
						createFile(content.length,contents,true,csvFileName);					
				}
				
				if (contents_skipped.length > 0)
				{
						log.debug('contents_skipped about to create file ',contents_skipped.length);						
						createFile(contents_skipped.length,new_headers+'\n'+contents_skipped,false, csvFileName_skipped);					
				}
				log.debug('contents reading is completed ',new_nSavedSearchRows);
				//log.debug('contents is ready',contents);
				 
				if (new_nSavedSearchRows == 0)
				{
					email.send({
						author : emailSender,
						recipients : recips,
						subject : "Found ZERO Kit Invadjs that required correction and created/modified today. Hence 5025Kit script is exiting..",
						body : "Click below Saved search link to find if there are any results,\n\n\n"+ savedSearchLink
					});
				}
				else
				{
				}
			}
			catch(err){
				log.error("error",JSON.stringify(err));
				email.send({
					author : emailSender,
					recipients : recips,
					subject : 'Error within 5025Kit script',
					body : "error\n\n\n"+ JSON.stringify(err)
				});
			};
			 
		};
		
 		
		function roundVal(val,dec) {
			var result = Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
			return result;
		}
		
		function executionTimesUp(){
			var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
			var minutesRunning = Math.floor((timeElapsed/1000)/60);
			return (minutesRunning >executionThreshold);
		}

		function parseFloatOrZero(val) {
			return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
		}
		
	    function createFile(rowId,contents,runCSV,csvFileName)
		{
			var rowMessage = rowId < 24995 ? '' : rowId+'_';
			var fileObj = file.create({
			  name: rowMessage+csvFileName,
			  fileType: file.Type.CSV,
			  contents: contents,
			  description: csvFileDescription+' Rows beginning : '+rowMessage,
			  folder: folderId
			});
			 
			var id = fileObj.save();
			log.debug('Csv file is saved and ID is',id);
			
			if (runCSV)
			{				
				if (processCSV =='T' || processCSV==true){
					var scriptTask = task.create({taskType: task.TaskType.CSV_IMPORT});
					scriptTask.mappingId = savedCsvId;
					var f = file.load(id); 
					scriptTask.importFile = f;
					var csvImportTaskId = scriptTask.submit();
					log.debug('CSV import staged with submitID ...',csvImportTaskId);
				}
				
				if (email5025KitResults =='T' || email5025KitResults==true){			
					//if (id==0) //Check if CSV import was successful or not (pending for coding)
					{
						email.send({
							author : emailSender,
							recipients : recips,
							subject : email_subj,
							body : email_msg + CSV_IMPORT_msg + ' CSV Job Name is '+csvImportTaskId
						});
					}
				}
			}
		}
 //case when {line} = 0 then 1 else (case when upper({memo}) like  '%KIT5025%' then 1 else 0 end) end
 
 		
	return {
		execute:execute
		}
	}
);