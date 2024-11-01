/**
* @NApiVersion 2.x
* @NScriptType scheduledscript 
*/

var nResultsCount=0;
var formulaStartTime ='';
var formulaEndTime ='';
var traExportSearchId = '1500';
var traExportSearchId_BeforeMidnightSlot = '1487';
var IsPriorDayPush = false;
var bDoNotProcessData = false;

const hourToExportPriorDay = 02; //21 (recommended 2am till 10pm)
const email_author = '1423';
const email_to_normal ='netsuite@mibar.net, alerts@jampaper.com';
const email_to_errors =['netsuite@mibar.net', 'anita@jampaper.com'];

define(
	[
		'N/https',
		'N/url',
		'N/search',
		'N/runtime',
		'N/email',
		'N/config',
	],
	function(https, url,search,runtime,email,config) {
		function scheduled(body){
			try{
				
				var currentdate_new = getCompanyDate();
                var hours = currentdate_new.getHours();
                var minutes = currentdate_new.getMinutes();
				//log.debug('currentdate_new ', currentdate_new + ' ,HOURS : ' + hours_new + ' minutes : '   + minutes_new);
                
				/*var currentTime = new Date();
                var hours = currentTime.getHours();
                var minutes = currentTime.getMinutes();*/
				
				traExportSearchId = fetchFormulaTime(minutes,hours); //'1500'; //saved search that drives exporting of transactions ( adds a filter in the code below).				
    			//traExportSearchId =  '1481'; //for testing if override is required
				
				// in the below log show the script_deployment_id so that which deployment got called.
				log.debug('time is ', currentdate_new + ' ,HOURS is ' + hours + ' Saved search ID : ' + traExportSearchId + ' (sleep 60 seconds)');
              	
				//traExportSearchId ='';
              
              	if (traExportSearchId == '')
                  {
					log.error('traExportSearchId', 'Please debug as to why searchID is blank');
					email.send({
						author: email_author,
						recipients : ['netsuite@mibar.net','anita@JamPaper.com'],
						subject : 'Saved search ID : Response in MB_Scheduled_Daily_Tra_export @ '+currentdate_new,
						body : 'traExportSearchId is blank. Invalid saved search : \n',
					});
              	    return;
            	}
				
				if (bDoNotProcessData) //means it is 2AM and this slot is meant for PriorDay push and hence this thread at 2:30am is returned without processing.
                 {
					log.error('Process aborted. bDoNotProcessData is true', 'current minute is' + minutes);
					email.send({
						author: email_author,
						recipients : ['netsuite@mibar.net'],
						subject : 'Saved search ID : Response in MB_Scheduled_Daily_Tra_export @ '+currentdate_new,
						body : 'Process aborted and data from this time will be captured later. bDoNotProcessData is true. current minute is : ' + minutes+' \n',
					});
              	    return;
            	}
								
				pause(60); //give 60 seconds for netsuite data to commit before retrieveing through saved search.
				//currentTime = new Date();
				//log.debug('time after sleep is ', currentTime);
              				
				var formulaText = "case when (to_char({lastmodifieddate},'hh24:mi') between '"+ formulaStartTime+ "' and '" + formulaEndTime + "' ) then 1 else 0 end";		
				log.debug('formulaText is ', formulaText);
    				
				var filter = search.createFilter({
					name : 'formulanumeric',
					operator : search.Operator.EQUALTO,
					values : [1],
					formula : formulaText	//	 "case when (to_char({lastmodifieddate},'hh24:mi') between '16:00' and '18:00') then 1 else 0 end"
				});
				
				// Jan 11th has around 125,000 rows and NS paged got 90,000 (ask why not full with NS) but flow failed. Check with Lucas on flow if there were any errors around 12:47am on 1/13
				// JAn 12th has 71500 and nsSAvedsearch produced data but flow didn't push.. check with NS.
				// To run for Jan 11 or Jan 12th, modify 1487 saved search with acctual date and run below block.
				
				//IsPriorDayPush =true;
				//traExportSearchId = 1487;
				//
				
				var traSrch = search.load({
					id: traExportSearchId
				});
				log.debug('search loaded', 'Going to get results of traSrch ID : '+ traExportSearchId);
				
				if (IsPriorDayPush==true)
				{
					log.error('IsPriorDayPush is true.', 'Filter is not added. current minute is' + minutes);
					email.send({
						author: email_author,
						recipients : ['netsuite@mibar.net'],
						subject : 'Saved search ID : Response in MB_Scheduled_Daily_Tra_export @ '+currentdate_new,
						body : 'IsPriorDayPush is true. current minute is : ' + minutes+' \n',
					});
				}
				else
				{	
					traSrch.filters.push(filter);			
				}
				var arrtraSrch = searchGetResultTxt(traSrch,null,null);
				var IsTimeStamp = "Y";	
				var IsData  = "N";	
				//if (nResultsCount !=0) //commented because of file not getting moved.
				{
					IsData  = "Y";
					IsTimeStamp = "N";
				}		
				log.debug('calling FLOW with records count ', nResultsCount);
				var bSend = 'Y'; // set to N if flow output is not required.				
				submitToFlow(bSend,arrtraSrch,IsTimeStamp,IsData);
					
			} catch(err){
				log.error('Error in datain',JSON.stringify(err));
				email.send({
					author: email_author,
					recipients : ['Lucas@mibar.net','anita@JamPaper.com'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Daily_Tra_export',
					body : 'Please see the attached error: \n'+JSON.stringify(err),
				});
			}
					
		};

		function searchGetAllResult(option){
			  try{
				var result = [];
				if(option.isLimitedResult == true)
				{
					log.debug('isLimitedResult ','True');					
					var rs = option.run();
					result = rs.getRange(0,1000);
					return result;
				}
				
				var rp = option.runPaged();
				//log.debug('pageRange ','True');
				var pgRangeCnt = 0;
				rp.pageRanges.forEach(function(pageRange){
					//log.debug('pageRange_1 ','True');
					pgRangeCnt++;
					var myPage = rp.fetch({index: pageRange.index});
					result = result.concat(myPage.data);
					//log.debug('pageRange result now ',result.length);
					// Each pagination is 50 rows. 
				});
				log.debug('pgRangeCnt total is  ',pgRangeCnt);
				
				return result;
			  }catch (e){
				  log.error('Error in searchGetAllResult',JSON.stringify(e));			  
			  }
		};

        function searchGetResultTxt(_search,_start,_end){
        	try{
	        	var results;
	        	if (_start!=null && _end!=null){
					log.debug('start is null ','True');
	            	results = _search.run()//.getRange({
            		results = results.getRange({
	            		start : _start,
	            		end : _end
            		})

	            	//});
	        	} else {
					//log.debug('within searchGetAllResult ','True');
					
	        		results = searchGetAllResult(_search);
	        	};
//	        	log.debug('results',JSON.stringify(results));
	        	var string = '';
	        	var columns = _search.columns;
	        	//log.debug('columns array is',JSON.stringify(columns)); //pramod
				for (x=0;x<columns.length;x++){
					var label = columns[x].label.replace(/ /g,"_");
					if(x+1!=columns.length){
						string+=label+'\t'
					} else {
						string+=label+'\r\n'
					};
				};
				nResultsCount=results.length;
	        	var arrResults = new Array();
	        	
	        	log.debug('results.length',results.length);
	        	
				var bTranIDChanged = true;
				var tranID = '';
	        	for (var k=0;k<results.length;k++){	        		
					var tempObj = new Object();				
	        		var result = results[k];

					if (tranID != result.getValue({name : "tranid"}) && tranID !='')
						{
							bTranIDChanged =true;
							//log.debug('old TranID and new TranID has changed  ',tranID+'##'+result.getValue({name : "tranid"}) + 'Line##'+result.getValue({name : "line"}));
						}

					if (bTranIDChanged==true)
					{
						if (result.getValue({name : "line"}) != '0')
						{
							log.emergency('Error in tranID where lineID zero is missing : ',result.getValue({name : "tranid"}) + '##'+result.getValue({name : "line"}));

							//email.send({
							//	author: email_author,
							//	recipients : ['pramod@mibar.net'],
							//	subject : 'Error in searchGetResultObjects - MB_Scheduled_Daily_Tra_export',
							//	body : 'LineID zero not found \n'+result.getValue({name : "tranid"}),
							//});
						}
					}
					
					for (i=0;i<columns.length;i++){
						//if(k==0){
							//log.debug('column '+i,JSON.stringify(columns[i]));
							//log.debug('column '+i+' value', result.getValue(columns[i]));
						//};
						
						if (columns[i].hasOwnProperty('join')==false){
							columns[i].join=null;
						};
						if (columns[i].hasOwnProperty('summary')==false){
							columns[i].summary = null;
						}
						
						var propName = columns[i].label.replace(/ /g,"_");
						
						tempObj[propName] = result.getValue(columns[i]);
						if(i+1!=columns.length){
							string+=result.getValue(columns[i])+'\t';
						} else {
							string+=result.getValue(columns[i])+'\r\n'
						}
					};
					tranID = result.getValue({name : "tranid"});
					bTranIDChanged = false;
					
//					tempArray.push(tempObj);
	        		arrResults.push(tempObj);
	        	};
	        	//return arrResults;
				return string
        	} catch(err){
        		log.error('err in searchGetResultObjects',JSON.stringify(err));
				email.send({
					author: email_author,
					recipients : ['Lucas@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Daily_Tra_export',
					body : 'Please see the attached error in the "dataIn" function: \n'+JSON.stringify(err),
				});
				return [];
        	}
        }
				
		function zeroPad(num, places) {
		  try{
			  var zero = places - num.toString().length + 1;
			  return Array(+(zero > 0 && zero)).join("0") + num;
		  }catch (e){
			  log.error('Error in zeroPad',JSON.stringify(e));			  
		  }
		}				
		
		function fetchFormulaTime(currentMinute,currentHour)		
		{
		  try{
			var actualHour = currentHour;
			var endingHour = currentHour;

			var startMin = 0; //default when minute is after half hour (30min)
			var endMin = 29; //default when minute is after half hour (30min)
			var searchIdExport = traExportSearchId;

			if (currentHour == hourToExportPriorDay && currentMinute >=30) // 02) // 2AM.. Full push of prior day data starts here.
			{
				bDoNotProcessData = true;
			}
			
			if (currentMinute <=29) //else assumed script ran after >=30th minute
			{
				actualHour = currentHour-1; //past hour
				endingHour = actualHour;
				startMin = 30;
				endMin = 59;
				if (currentHour == 00) // which is midnight //value is 21 as per GMT (or without config value of company settings)
				{
					actualHour = 23; //11pm
					endingHour = 23;
					searchIdExport = traExportSearchId_BeforeMidnightSlot; //same as defaultSearch except it runs for YESTERDAY.
				}
				if (currentHour == hourToExportPriorDay) // 02) // 2AM.. Full push of prior day data starts here.
				{
					bDoNotProcessData = false;
					IsPriorDayPush = true;
					actualHour = 00;
					searchIdExport = traExportSearchId_BeforeMidnightSlot; //same as defaultSearch except it runs for YESTERDAY.
				}
				if (currentHour == hourToExportPriorDay+1) //03) // 3AM.. Push of current day data from 01:30am till 2:59am
				{
					actualHour = currentHour-2;
					endingHour = currentHour-1;
				}
			}

			formulaStartTime= zeroPad(actualHour, 2) + ':'+ zeroPad(startMin, 2);
			formulaEndTime= zeroPad(endingHour, 2) + ':'+ zeroPad(endMin, 2);

			/* PadStart funcdtion not loaded in NS context
			var str = actualHour.toString().padStart(2,"0");			
			formulaStartTime = str+':'; //+startMin.toString();
			str = startMin.toString().padStart(2,"0");			
			formulaStartTime += str; //+startMin.toString();

			str = endingHour.toString().padStart(2,"0");			
			formulaEndTime =str+':'; //+endMin.toString();
			str = endMin.toString().padStart(2,"0");
			formulaEndTime +=str; //+endMin.toString();
			*/
			
			//log.debug('formulaStartTime  and formulaEndTime',formulaStartTime + '##'+formulaEndTime);
			return searchIdExport;
		  }catch (e){
			  log.error('Error in fetchFormulaTime',JSON.stringify(e));			  
		  }
		}
		
		function submitToFlow(bSend,dataToPost,IsTimeStamp,IsData)
		{
		  try{
			if (bSend == 'N')
			{
				log.debug('Flow',+ ' Not called as bSend is '+bSend);
				return;
			}
			
			var flowUrl = 'https://prod-186.westus.logic.azure.com:443/workflows/d9b6aa5472064477a7eb8cece54dbb17/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=kuFr1brws1zQ2Tuu6hojoKc1hlzN8BO1fSjTufxcC1k';
			
			var _clientResponse = https.post({
				method:https.Method.POST,
				url : flowUrl,
				body : JSON.stringify({"data":dataToPost,"TimeStamp":IsTimeStamp,"Data":IsData })
			});
			
			log.debug('client response',JSON.stringify(_clientResponse.body));
			
			if (nResultsCount ==0)
			{ 
				log.debug('nResultsCount', ' record count is zero. EXECUTION range : ' +formulaStartTime +  ' to : ' + formulaEndTime);		
				email.send({
					author: email_author,
					recipients : ['netsuite@mibar.net','anita@JamPaper.com'], 
					subject : 'No Results found in MB_Scheduled_Daily_Tra_export',
					body : 'Saved Search ID : ' + traExportSearchId + ' produced no results during this execution. \n',
				});					
			}
			else
			{
				email.send({
					author: email_author,
					recipients : ['netsuite@mibar.net','anita@JamPaper.com'], // ['pramod@mibar.net'],
					subject : 'Response in MB_Scheduled_Daily_Tra_export',
					body : 'Record count : ' + nResultsCount +' Please see the attached response for SearchID : ' + traExportSearchId + 
						' : \n'+JSON.stringify(_clientResponse.body),
				});
			}
		  }catch (e){
			  log.error('Error in submitToFlow',JSON.stringify(e));			  
		  }
		}

		
		function getCompanyDate(){
		  try{
				var currentDateTime = new Date();
				var companyTimeZone = config.load({ type: config.Type.COMPANY_INFORMATION }).getText({ fieldId: 'timezone' });
				var timeZoneOffSet = (companyTimeZone.indexOf('(GMT)') == 0) ? 0 : Number(companyTimeZone.substr(4, 6).replace(/\+|:00/gi, '').replace(/:30/gi, '.5'));
				var UTC = currentDateTime.getTime() + (currentDateTime.getTimezoneOffset() * 60000);
				var companyDateTime = UTC + (timeZoneOffSet * 60 * 60 * 1000);

				return new Date(companyDateTime);
		  }catch (e){
			  log.error('Error in getCompanyDate',JSON.stringify(e));			  
		  }
		}
		
		function pause(waitTime){ //seconds
			  try{
				  var endTime = new Date().getTime() + waitTime * 1000;
				  var now = null;
				  do{
					  now = new Date().getTime(); //
				  }while(now < endTime);
			  }catch (e){
				  log.error('Error in sleep function.',JSON.stringify(e));			  
			  }
		}      
				
        /*
        function createGuid(){
        	return (s4() + s4() + "-" + s4() + "-4" + s4().substr(0,3) + "-" + s4() + "-" + s4() + s4() + s4()).toLowerCase();
;
        }
        
        function s4() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
        }
        
        function base64(stringInput){
            var base64String = encode.convert({
                string: stringInput,
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64
            });
            return base64String;
        }
		
		function fetchTxnData(traSrch)
		{
			try {
				traSrch.run().each(function(result)
				{								
					var so_itm_member  = result.getValue({
						name : 'memberitem' 
					});
					
					var so_itm_member_name  = result.getText({
						name : 'memberitem' 
					});
					
					var so_itm_member_substitute  = result.getValue({
						name: "custitem_mb_item_attribute_substitute",
						join: "memberItem" 
					});
				
					var so_itm_member_qtyavail  = result.getValue({
						name: "quantityavailable",
						join: "memberItem" 
					});

					var so_itm_member_pksize = result.getValue({
						name: 'memberquantity'
					});
					so_itm_member_qtyavail = so_itm_member_qtyavail == null ? '0' :so_itm_member_qtyavail;
					so_itm_member_qtyavail = so_itm_member_qtyavail == '' ? '0' :so_itm_member_qtyavail;

					log.debug('so_itm_member_substitute and so_itm_member_qtyavail',so_itm_member_substitute +'##'+so_itm_member_qtyavail);
					var IsSubstituted = parseInt(so_itm_member_qtyavail.toString()) <= 0 ? 'Y' : 'N';
						IsSubstituted = (so_itm_member_substitute.length  > 0 && IsSubstituted == 'Y') ? 'Y' : 'N';
						
					var newMemberItem = (IsSubstituted == 'Y' ? so_itm_member_substitute :   so_itm_member);
					so_itm_members	=so_itm_members+newMemberItem;
					
					var item_member = {
						member : newMemberItem,
						substituted : IsSubstituted,
						//member_substitute : so_itm_member_substitute,
						actual_member : so_itm_member,
						actual_member_pksize : so_itm_member_pksize, //packSize used in Assembly called as MemberQty
						actual_member_available : so_itm_member_qtyavail
					};
					arr_itm_members.push(item_member);
					so_itm_members_only.push(newMemberItem);
					so_itm_members+=',';
					log.debug('findSoItemComponents so_itm_members is ',so_itm_members);
					return true;
				});
			} catch(err){
				log.error('Error in fetchTxnData',JSON.stringify(err));
			}
		}
		
		*/
        
    return {
    	execute : scheduled
    }
});
