/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

var EMAIL_FROM_DEFAULT = 51;

define(
	[
		'N/email',
		'N/file',
		'N/record',
		'N/runtime',
		'N/search'
	],
	function(email, file, record, runtime, search) {
				
		const TEMP_FOLDER = "RCM/Tempfiles/";
		/**
		 * Definition of the Scheduled script trigger point.
		 * 
		 * @param {Object}
		 *            scriptContext
		 * @param {string}
		 *            scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
		 * @Since 2015.2
		 */

		function execute(scriptContext) {
			try{
				var importResults = getImportResults();
				var fileInfo; 				
				var goodCount = importResults.goodCount ;
				var badCount = importResults.badCount; 
				if(goodCount+badCount !=0){
					var formattedResults = formatResults(importResults.statList);
					if (formattedResults){
						filePath = TEMP_FOLDER + newName(); 
						fileInfo = uploadFile(filePath,formattedResults); 
					};
					var respText = "Here are the checks for the latest set of imported sales orders. ";
					respText +='<br>There were ~1 imports processed.'.replace('~1',goodCount.toString());
					if(badCount!=0)
						respText += "<br>Please note: ~2 imports could not be processed due to errors. ".replace('~2',badCount.toString());
					sendNotification(respText,fileInfo);
				}
			}
			catch(err){
				throw err;
			}
		}
		function newName(){
			var dateObject = new Date(); 
			var newName = "Logs_"+dateObject.toISOString().split('T')[0]+((dateObject.toISOString().split('T')[1]).split(".")[0]).replace(/:/g,"");
			newName+=".txt"
			return newName;
		}
		function getImportResults(){

			var statList = new Array(); 
			var srchIdx = 0; 
			var goodCount = 0; 
			var badCount = 0; 				
			var searchResults = runSearch();
			if (searchResults) {
				do {
					var resultSlc = searchResults.getRange({
						start : srchIdx,
						end : srchIdx + 1000
					});        // Retrieve results in 1000-row slices.
					for (var i in resultSlc) {                                //Step through the result rows.
						var transactionId =  resultSlc[i].id;                // Get Result record internal Id
						var transactionType = resultSlc[i].recordType;        // Get Result record type
						log.debug("processing record ", transactionId);

						var CSVStats = checkCSVCounts(resultSlc[i]);
						statList.push(CSVStats); 
						log.debug("CSVStats",JSON.stringify(CSVStats)); 

						if(CSVStats.checks != "F,F,F"){
							record.submitFields({
								type: transactionType,
								id : transactionId,
								values : { custrecord_mb_import_checked : 'T'}
							});
							goodCount++
						}
						else badCount++;

						srchIdx++;
					}								
				} while (resultSlc.length >= 1000);
			}
			
			var runStats = {
				statList : statList,
				goodCount: goodCount,
				badCount: badCount
			}

			return runStats;
		}
		
		function checkCSVCounts(resultSlc){
			var importBatch = resultSlc.getValue({name: "name"});
			var CSVStats = {importBatch: importBatch };
			try{
				var checkList = new Array(); 

				// compare count of lines to total lines
				var lineCount = resultSlc.getValue({name: "custrecord_mb_line_count"});
				// CSV type batches have a correct line count. SQL type batches are off by 1. Rather than find error in C# side just hack it here. 
				if(importBatch.substring(0,3) =="SQL") lineCount--; 		// header line
				var actualLineCount = getSearchCount("customsearch_mb_batch_items",importBatch);
				if(lineCount != 0 && lineCount != actualLineCount){
					CSVStats.lineCount = lineCount || 0 ; 
					CSVStats.actualLineCount = actualLineCount ||0 ;
					checkList.push("Y");
				}else 
					checkList.push("N"); 

				// compare count of orders to actual order count 
				var orderCount = resultSlc.getValue({name: "custrecord_mb_order_count"});
				var actualOrderCount = getSearchCount("customsearch_mb_import_order_checker",importBatch);
				if(orderCount != 0 && orderCount != actualOrderCount){
					CSVStats.orderCount = orderCount || 0 ; 
					CSVStats.actualOrderCount = actualOrderCount || 0 ;
					checkList.push("Y");
				}else 
					checkList.push("N"); 

				// find how many bad items were used. 
				var badItems = getBadItems(importBatch);
				if(badItems.length!=0){
					checkList.push("Y");
					CSVStats.badItems = badItems; 					
				}else{
					checkList.push("N"); CSVStats.badItems = new Array(); // send back and empty array 
				} 

				CSVStats.checks = checkList.join(","); 
			}
			catch(err){
				CSVStats.checks = "F,F,F";
			}
			return CSVStats;
		}

		/** gets an order count for a given batch from a search
		 * 
		 *@returns retVal - an int holding the requested count for this batch
		 */
		function getSearchCount(searchId,importBatch){

			log.debug("searchId",searchId);        		
        		
			var searchObj = search.load({id : searchId});
			log.debug("importBatch",importBatch);

			var orderType = importBatch.substring(0,3) == "SQL" ? "CustInvc" : "SalesOrd" ; 			
			var filter = search.createFilter({ name :'type',operator : search.Operator.ANYOF,values : [orderType]});
			searchObj.filters.push(filter);
	
			if (importBatch){
				var filter = search.createFilter({ name :'custbody_mb_import_batch',
					operator : search.Operator.IS,
					values : importBatch});
				searchObj.filters.push(filter);
			};
			var columns = searchObj.columns;
			 log.debug("search",JSON.stringify(searchObj));
			var retVal = 0; 
			searchObj.run().each(function(result) {
				// console.log(result.getValue(columns[0])); 
				log.debug("retVal",JSON.stringify(result)); 				
				retVal = result.getValue(columns[0])
				return true;
			});
			return retVal; 
		}

		/** 
		 * 
		 * gets a list of bad items for a given batch
		 * 
		 *@returns a list of orders with bad item counts 
		*/
		 function getBadItems(importBatch){
        		
			var searchId = "customsearch_mb_bad_items"
			var searchObj = search.load({id : searchId});
		
			if (importBatch){
				log.debug("importBatch",importBatch);
				var filter = search.createFilter({ name :'custbody_mb_import_batch',
					operator : search.Operator.IS,
					values : importBatch});
				searchObj.filters.push(filter);
			};
			var columns = searchObj.columns;
			// log.debug("search",JSON.stringify(searchObj));
			var retList = new Array(); 
			searchObj.run().each(function(result) {
				log.debug("itemcount",result.getValue(columns[0])); 
				var itemCount = result.getValue(columns[0]);
				var tranId  =  result.getValue(columns[2]);
				retList.push({itemCount : itemCount , tranId : tranId });
				return true;
			});
			return retList; 
		}
		
		/**
		 *  runs a search on the import log for unchecked imports
		 * @returns array of search results with log records to be checked
		 */
		function runSearch(){
			oSearch = new Object();
			oSearch.type = 'customrecord_mb_csv_import_log';
			oSearch.filters = [
				search.createFilter({name: "custrecord_mb_import_checked", operator: search.Operator.IS,values: 'F'}),									   
			];
			oSearch.columns = [
				search.createColumn({name: "name"}),
				search.createColumn({name: "custrecord_mb_order_count"}),
				search.createColumn({name: "custrecord_mb_line_count"})
			];
		
			var searchObj = search.create(oSearch);
	
			var searchResults = searchObj.run();                    // Execute Search.
			return searchResults;
		}
		
		function formatResults(statsList){
			var formattedResults="";
			// console.log(JSON.stringify(statsList));
			// console.log(statsList.length);
	
			statsList.forEach(function (statLine){
				// console.log(JSON.stringify(statLine));
	
				formattedResults += "Batch (~1) Import Results\n\r"
					.replace("~1",statLine.importBatch);
				checks = statLine.checks.split(",");
				if(checks[0] == "Y"){
					formattedResults+= "\tLine item mismatch ~1 lines in csv, ~2 lines found.\n\r"
						.replace("~1",statLine.lineCount)
						.replace("~2",statLine.actualLineCount);
				}
	
				if(checks[1] == "Y"){
					formattedResults+= "\tOrder count mismatch ~1 orders in csv, ~2 orders found.\n\r"
						.replace("~1",statLine.orderCount)
						.replace("~2",statLine.actualOrderCount);
				}
	
				if(checks[2] == "Y"){
					formattedResults+= "\tOrders with missing Items.\n\r";
					statLine.badItems.forEach(function (element) {
						formattedResults+= "\t\t ~1 (~2).\n\r"
							.replace("~1",element.tranId)
							.replace("~2",element.itemCount);
					});
				}
				formattedResults+= "\n\r";
			});
			return formattedResults;
		}
		/////////////////// START file handling functions ///////////////////////////////////////
				
		function uploadFile(relFilePath, content) {
			var fullFilePath = relFilePath;
			
			try {
				var loadedFile = file.load({id: fullFilePath});
				var fileInfo = updateFile(loadedFile, content);
			} catch (e) {
				if (e.name == 'RCRD_DSNT_EXIST') {
					var fileInfo = createFile(fullFilePath, content);
				} else {
					throw e;
				}
			}

			log.debug({
				title: "PF fileInfo",
				details: JSON.stringify(fileInfo)
			})
			return fileInfo; 
		}

		function updateFile(existingFile, content) {
			var fileObj = file.create({
			name: existingFile.name,
			fileType: existingFile.fileType,
			contents: content,
			description: existingFile.description,
			encoding: existingFile.encoding,
			folder: existingFile.folder,
			isOnline: existingFile.isOnline
			});
			var fileId = fileObj.save();
			return {id: fileId , fileObj: fileObj}
		}

		function createFile(filePath, content) {
			var pathArray = filePath.split('/');
			var name = pathArray[pathArray.length - 1];
			var fileType = file.Type.PLAINTEXT;
			var folder = createFolderIfNotExist(
			filePath.substring(0, filePath.lastIndexOf('/')));

			var fileObj = file.create({name: name,fileType: fileType,contents: content,folder: folder});
			var fileId = fileObj.save();        
			return {id: fileId, fileObj: fileObj};
		}
		function createFolderIfNotExist(folderPath, parentId) {
			var folderArray = folderPath.split('/');
			var firstFolder = folderArray[0];
			var nextFolders = folderArray.slice(1);
			var filters = [];

			filters.push({name: 'name',operator: 'is',values: [firstFolder]});
			if (parentId) {
				filters.push({name: 'parent',operator: 'anyof',values: [parentId]});
			} else {
				filters.push({name: 'istoplevel',operator: 'is',values: true});
			}

			var folderSearch = search.create({type: search.Type.FOLDER,filters: filters});

			var folderId = null;
			folderSearch.run().each(function (result) {
				folderId = result.id;
				return false;
			});

			if (!folderId) {
				var folderRecord = record.create({type: record.Type.FOLDER});
				folderRecord.setValue({fieldId: 'name',value: firstFolder});
				folderRecord.setValue({fieldId: 'parent',value: parentId});
				folderId = folderRecord.save();
			}

			if (!nextFolders || nextFolders.length == 0) return folderId;

			return createFolderIfNotExist(nextFolders.join('/'), folderId);
		}
		/////////////////// END file handling functions ///////////////////////////////////////

		function sendNotification(respText,fileInfo){
			var author = EMAIL_FROM_DEFAULT;
			var recipients = runtime.getCurrentScript().getParameter({name:'custscript_mb_user_implog'});
			var subject = "Todays Import Batch Report";
			var body = respText;

			email.send({
				author: author,
				recipients: recipients,
				subject: subject,
				attachments: [fileInfo.fileObj],
				cc : ['netsuite@mibar.net'],
				body: body
			});

			file.delete({id: fileInfo.id});			
			log.debug("mail sent",author);
		}
		
		return {
			execute : execute
		};

});