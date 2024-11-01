/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
*/

const searchId_dateCreated = 'customsearch_mb_item_modified_attr_updt'; //'customsearch_mb_item_modified_this_week' //'customsearch_mb_item_attr_all_items_par'
const searchId_parentSwitch = 'customsearch_mb_item_switched_today'; 

const folderId = 740;
const csvFileName = 'ItemAttr_rolldown_PAR_Only.csv';
const csvFileDescription = 'Rolldown attributes from PAR items';
const savedCsvId= 307; 
//const urlFileCabinet = 'https://4668299.app.netsuite.com/app/common/media/mediaitemfolders.nl?folder=740';
const urlFileCabinet ='https://4668299.app.netsuite.com/core/media/media.nl?id=38243&c=4668299&h=877800a9aaf4e63693f2&_xt=.csv'
const urlFile = 'https://4668299.app.netsuite.com/app/common/media/mediaitem.nl?id=38243'
const savedSearchLink = 'https://4668299.app.netsuite.com/app/common/search/searchresults.nl?searchid=1206&saverun=T&whence=';
const csvJobStatusLink = 'https://4668299.app.netsuite.com/app/setup/upload/csv/csvstatus.nl?whence=';
const emailSender ='-5';
//const recips = ["pramod@mibar.net"];
const recips = ["Netsuite@mibar.net,ryan@jampaper.com,kelly@jampaper.com"];
const email_subj = "Attributes rolldown script has generated NEW file.";
const email_msg = "Fyi, You should review the csv file after downloading it using below link  \n \n"+urlFileCabinet+"\n \n";
const CSV_IMPORT_msg = "Fyi, check status of CSV import using below link \n \n"+csvJobStatusLink+"\n \n";

const MINIMUM_USAGE = 300;
var startDateTime = new Date();
//const executionThreshold  = 40; //pull from general_Preferences
		  
define(['N/search', 'N/record','N/email','N/file','N/runtime','N/task'],
	function (search,record,email,file,runtime,task){
		function execute(context){
			
                var currentTime = new Date();
                var hours = currentTime.getHours();
                var minutes = currentTime.getMinutes();
				var itemSearchId = searchId_dateCreated;
              
    	      	if (minutes > 30) {
					itemSearchId = searchId_parentSwitch;					
				}
			
			var mySearch = search.load({
			  id:  itemSearchId //searchId
			 });
			executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
			
			/*todo : load saved search within script.
			//add filter : if today is firstSundayofMonth then datecreated filter should not be added. otherwise it should be dateCreated is today.
			1) To_Char({today},'DAY') --- Current Day fullName
			2) To_Char({today},'D') --- Day of the week
			3) To_Char({today},'DY') --- Day ShortName
			4) To_Char({today},'W') --- Week of Month
			
			so, if (4) is 1 and 3 is SUN, then do not add filter, If not add it.
			*/
			log.debug('mySearch', mySearch);
			var headers = new Array();
			var columns = mySearch.columns;
			var temp = new Array();
			var nSavedSearchRows = 0;
			var content = new Array();
			var cells = new Array();
			 
			for(var i=0; i< columns.length; i++){
			  headers[i] = columns[i].name;
			  log.debug('col ',headers[i]); 
			} 
			content[nSavedSearchRows] =  headers;
			nSavedSearchRows =1;
		
			var searchResults = mySearch.run();                    //Execute Search.
			if (searchResults) {
				var srchIdx = 0; var goodCount = 0; var badCount = 0; var testCount = 0;
				var getOut = false;
				
				do {
					var resultSlc = searchResults.getRange({
						start : srchIdx,
						end : srchIdx + 1000
					});        //Retrieve results in 1000-row slices.

					for (var i in resultSlc) {                                //Step through the result rows.
						for(var y=0; y< columns.length; y++){
						  //log.debug('col within resultSlc : ',columns[y].name); 
						  var searchResult = resultSlc[i].getValue({
						   name: columns[y].name
						  });
						  temp[y] = searchResult;
						  //log.debug(temp[y],searchResult); 
						}
						content[nSavedSearchRows] +=temp;
						nSavedSearchRows++; 
						srchIdx++;

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
			}
			
			try {
			 
			/*
			var columns = mySearch.columns;
			log.debug('mySearch', columns);
			log.debug('mySearch length', columns.length);
			 
			 //Creating arrays that will populate results
			var content = new Array();
			var cells = new Array();
			var headers = new Array();
			var temp = new Array();
			var nSavedSearchRows = 0;
			 
			for(var i=0; i< columns.length; i++){
			  headers[i] = columns[i].name;
			  //log.debug('col ',headers[i]); 
			} 
			 
			content[nSavedSearchRows] =  headers;
			nSavedSearchRows =1;
			 
			mySearch.run().each(function(result){	
			//log.debug('content',content);
			//looping through each columns
		    for(var y=0; y< columns.length; y++){
		   
			  var searchResult = result.getValue({
			   name: columns[y].name
			  });
			  temp[y] = searchResult;
			  //log.debug(temp[y],searchResult); 
			}
			 content[nSavedSearchRows] +=temp;
			 nSavedSearchRows++; 
			 return true; 
			});
			*/
			  
			  //Creating a string variable that will be used as CSV Content
			var contents='';
			for(var z =0; z<content.length;z++){
			   
			   if (z ==24995 || z ==49990 || z ==74985)
			   {
					log.debug('contents count is ','24995 || z ==49990 || z ==74985');
					createFile(z,contents)
					contents=headers + '\n';
			   }
			   contents +=content[z].toString() + '\n';
			}

			if (contents != headers + '\n')
			{
				log.debug('contents count is ',content.length);
				createFile(content.length,contents);				
			}

			log.debug('contents reading is completed ',nSavedSearchRows);
			//log.debug('contents is ready',contents);
			 
			if (nSavedSearchRows == 1 && itemSearchId != 'customsearch_mb_item_switched_today')
			{
				{
					email.send({
						author : emailSender,
						recipients : recips,
						subject : "Found ZERO child Items that were created Today. Search ID : "+ itemSearchId,
						body : "Hence rolldown script is exiting. Click below Saved search link to find if there are any results,\n\n\n"+ savedSearchLink
					});
				}
			 }
			 else
			 {
				/*
				var fileObj = file.create({
				  name: csvFileName,
				  fileType: file.Type.CSV,
				  contents: contents,
				  description: csvFileDescription,
				  folder: folderId //144
				});
				 
				var id = fileObj.save();
				log.debug('Csv file is saved and ID is',id);
							
				log.debug('getting ready with CSV import','');
				 
				 //var csv = task.create({
				 //	taskType: task.TaskType.CSV_IMPORT,
				 //	mappingId: 307,
				 //	fileId: id
				 //})
				 //var csvImportTaskId = csv.submit();
				return; 
				var scriptTask = task.create({taskType: task.TaskType.CSV_IMPORT});
				scriptTask.mappingId = savedCsvId; 
				var f = file.load(id); 
				scriptTask.importFile = f;
				var csvImportTaskId = scriptTask.submit();
				log.debug('CSV import staged with submitID ...',csvImportTaskId);
				//if (id==0) //Check if CSV import was successful or not (pending for coding)
				{
					email.send({
						author : emailSender,
						recipients : recips,
						subject : email_subj,
						body : email_msg + CSV_IMPORT_msg + ' CSV Job Name is '+csvImportTaskId
					});
				}
				*/
			 }
			}
			catch(err){
				log.error("error",JSON.stringify(err));
				email.send({
					author : emailSender,
					recipients : recips,
					subject : 'Error within rollDown script. Search ID : '+ itemSearchId,
					body : "error\n\n\n"+ JSON.stringify(err)
				});
			};
			 
		};
		
		function executionTimesUp(){
			var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
			var minutesRunning = Math.floor((timeElapsed/1000)/60);
			return (minutesRunning >executionThreshold);
			
		}

	    function createFile(rowId,contents)
		{
			var rowMessage = rowId < 24995 ? '' : rowId+'_';
			var fileObj = file.create({
			  name: rowMessage+csvFileName,
			  fileType: file.Type.CSV,
			  contents: contents,
			  description: csvFileDescription+' Rows beginning : '+rowMessage,
			  folder: folderId //144
			});
			 
			var id = fileObj.save();
			log.debug('Csv file is saved and ID is',id);
			var scriptTask = task.create({taskType: task.TaskType.CSV_IMPORT});
			scriptTask.mappingId = savedCsvId; 
			var f = file.load(id); 
			scriptTask.importFile = f;
				var csvImportTaskId = scriptTask.submit();
				//csvImportTaskId='420';
				log.debug('CSV import staged with submitID ...',csvImportTaskId);

			//if (id==0) //Check if CSV import was successful or not (pending for coding)
			{
				email.send({
					author : emailSender,
					recipients : recips,
					subject : email_subj + ' Search : Check execution time ',
					body : email_msg + CSV_IMPORT_msg + ' CSV Job Name is '+csvImportTaskId
				});
			}
		}
				/*
				switch (z) {
					case 0:
					    contents='';
						contents +=headers + '\n';
						createFile(z,contents)
						break;
					case 24995:
						contents='';
						contents +=headers + '\n';
						createFile(z,contents)
						break;
					case 49990:
						contents='';
						contents +=headers + '\n';
						createFile(z,contents)
						break;
					case 74985: //fourth csv file required.
						contents='';
						contents +=headers + '\n';
						createFile(z,contents)
						break;
				}*/
		
	return {
		execute:execute
		}
	}
);
