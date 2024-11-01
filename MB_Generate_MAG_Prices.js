/**  
* @NApiVersion 2.x  
* @NScriptType ScheduledScript  
* @NModuleScope SameAccount  
* Owner: 
* Author: 
* Support: 
* Purpose: Export saved search 'JAM | Inv. Item Price Group & Levels | Special Price (Test)' Process and output as csv to File cabinet
 * Definition of the Scheduled script trigger point.
 *
 * @param {Object} scriptContext
 * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
 * @Since 2015.2
*/ 
define(['N/search','N/file','N/https','N/runtime','N/task'], function(search,file,https,runtime,task) { 


  
	//Load saved search :: JAM | Inv. Item Price Group & Levels | Special Price :: ID 10452 ((Test))
	
	function execute(scriptContext){
		try{
			const itemSrchId = 11871//11812;// SB2 - 10451;
			const priceSrchId = 11971 //11912;//SB2 - 10452;
			const flowUrl = 'https://prod-155.westus.logic.azure.com:443/workflows/0f9ee8b974da4e0b89d857f8ebd3bf0f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=qlZ1umOp8eYi-b1wLsRh0DsARTZ4Ayoye5-W433bGRg';
			const scriptId = 2756//'1654';
			const stagingFlowUrl = 'https://prod-123.westus.logic.azure.com:443/workflows/30a0e823fadf44a28e373d461a4c56ce/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=mkZvFhyNAtR7OnCPRBq8DZFT5YnmGr0FVPh-nJWqUYc';
			var itemSrch = search.load({ id : itemSrchId });
			var start = runtime.getCurrentScript().getParameter({name:'custscript_mb_search_start'});
			if(start==0 || start==null || start==''){
				start=0
			} else {
				start= parseInt(start);
			};
			
			var end = parseInt(start)+999;
			
			log.debug('start,end',start.toString()+','+end.toString());
			
			var itemSrchResults = searchGetResultObjects(itemSrch,start,end); // Add internalId as column name 'internalId'
	//		var srchResults = searchGetResultObjects(itemSrch,null,null);
//			log.debug('itemSrchResults',JSON.stringify(itemSrchResults)); // give you the stringified body of the search you just turned into objects. 
			
			var priceSrch = search.load({id : priceSrchId});
			
			var internalIds = itemSrchResults.map(function(item,index){
				return item.internalId
			});
			var distinctInternalIds = internalIds.filter(function(item,index){
				if(internalIds.indexOf(item)===index){
					return true;
				};
				return false;
			})
			var filter = search.createFilter({
    			name : 'internalid',
    			operator : search.Operator.ANYOF,
    			values : distinctInternalIds
    		});
			
			priceSrch.filters.push(filter);
			/*
			 * filter priceSrch by using internal IDs from the first itemSrch -- add later
			 */
			
			var priceSrchResults = searchGetResultObjects(priceSrch,null,null);


	//		var priceSrchResults = searchGetResultObjects(priceSrch,0,1);
			
//			log.debug('priceSrchResults',JSON.stringify(priceSrchResults)); // gives you the stringified body of the priceLevelSrch;
			
			var array = new Array();
			
			if(itemSrchResults){
				for(var i=0;i<itemSrchResults.length;i++){
//					log.debug('result',JSON.stringify(itemSrchResults[i])) // gives you the individual result you're iterating over. 
					var tempObj = {};
					
					var result = itemSrchResults[i];
					
					tempObj.sku = result.SKU;
					tempObj.base_price = result.Base_Price;
					tempObj.special_price = result.Special_Price;
					tempObj.tier_prices = '';
					
					/*
					 * 
					 * 1) Play around with filtering logic that we reviewed last friday to add in tiered pricing object.
					 * (below)
					 * */
					
					var tierPricesArray = priceSrchResults.filter(function(item){
						if(item.internalId == result.internalId && result.Base_Price != item.Unit_Price){
							return true;
						}
						return false;
					});
					
//					log.debug('tierPricesArray',JSON.stringify(tierPricesArray));
					
					var tierPricesString = '';
					/*
					 * 2) Set tiered_prices property equal to array returned from filtering function;
					 * (below) ;
					 */
					if(tierPricesArray){
						for(var k = 0; k<tierPricesArray.length;k++){
							
							var customerGroup = (tierPricesArray[k].Price_Level_text == 'Base Price' ? 'ALL GROUPS' : tierPricesArray[k].Price_Level_text);
//							log.debug('customerGroup',customerGroup)
							var minQty = tierPricesArray[k].Min_Qty.toString();
//							log.debug('minQty',minQty)

							var price = tierPricesArray[k].Unit_Price.toString();
//							log.debug('price',price);
							var percent = '0';
//							log.debug('percent',percent);
							var website = (tierPricesArray[k].Price_Level_text == 'Base Price' ? 'ALL' : tierPricesArray[k].Price_Level_text);
//							log.debug('website',website)
							tierPricesString+=customerGroup + ',' + minQty + ',' + price + ',' + percent + ',' + website;
							if(k+1 != tierPricesArray.length){
								tierPricesString+='|'
							};
						}
					};
					
//					log.debug('tierPricesString',tierPricesString);
					tempObj.tier_prices = tierPricesString;
					
//					tempObj = result;
//					log.debug('tempObj for '+i, JSON.stringify(tempObj));
					array.push(tempObj);
					
				}
			};
			log.debug('finalArray',JSON.stringify(array));
			
			if(array.length>0){
//				var feed_name = 'pricingFeed'+start+'_'+end
    			var jsonObject = {
					feedName : 'pricingFeed',//+"TESTINGTESTING",
					data : array
    			};
    			
    			var response = https.post({
					method:https.Method.POST,
					url : flowUrl,
					body : JSON.stringify(jsonObject)
				});	

				var response2 = https.post({
					method:https.Method.POST,
					url : stagingFlowUrl,
					body : JSON.stringify(jsonObject)
				});	

    			log.debug('https response',JSON.stringify(response));
	    		log.debug('end+1',end+1);
	    		var params = {
    				'custscript_mb_search_start' : end+1
	    		};
	    		var task = scheduleScript(scriptId,params);
	    		log.debug('task in execute block',task);
			}
			
		}catch(err){
			log.error('err in execute function', JSON.stringify(err));
		}
			
	};
	
	function searchGetResultObjects(search,_start,_end){
      	try{
      		
          	var results;
          	if (_start!=null && _end!=null){
              	results = search.run();//.getRange({
          		results = results.getRange({
              		start : _start,
              		end : _end
          		})

              	//});
          	} else {
          		results = searchGetAllResult(search);
          	};
//          	log.debug('results',JSON.stringify(results));
          	
          	var columns = search.columns;
//          	log.debug('columns',JSON.stringify(columns));

          	var arrResults = new Array();
          	
//          	log.debug('results.length',results.length);
          	
          	for (var k=0;k<results.length;k++){
          		
    				var tempObj = new Object();				
    				var _result = results[k];
    				for (i=0;i<columns.length;i++){
    					
    					if (columns[i].hasOwnProperty('join')==false){
    						columns[i].join=null;
    					};
    					if (columns[i].hasOwnProperty('summary')==false){
    						columns[i].summary = null;
    					}
    					
    					var propName = columns[i].label.replace(/ /g,"_");
    					
    					tempObj[propName] = _result.getValue(columns[i]);
    					
    					var textName = propName+'_text';
    					
    					tempObj[textName] = _result.getText({
    						name : columns[i].name,
    						join : columns[i].join,
    						summary : columns[i].summary
    					});
    				};
    				
//    				tempArray.push(tempObj);
          		arrResults.push(tempObj);
          	};
          	return arrResults;
      	} catch(err){
      		log.error('Error in SearchGetResultObjects',JSON.stringify(err))//,'SearchGetResultObjects','MB_Scheduled_Generate_Mag_Prices',false,null);
      	};

      };
    	
      function searchGetAllResult(option){
          var result = [];
          if(option.isLimitedResult == true){
              var rs = option.run();
              result = rs.getRange(0,1000);
              
              return result;
          }
          
          var rp = option.runPaged();
          rp.pageRanges.forEach(function(pageRange){
              var myPage = rp.fetch({index: pageRange.index});
              result = result.concat(myPage.data);
          });
          
          return result;
      };
      
      function scheduleScript(script,params){
      	try{
      		var scriptTask = task.create({
      			taskType : task.TaskType.SCHEDULED_SCRIPT
      		});
      		scriptTask.scriptId = script;
      		scriptTask.params = params;
      		var taskID = scriptTask.submit();
      		log.debug('taskID for script: '+script,taskID);
      		return taskID;
      	}catch(err){
      		errorHandler(err,'scheduleScript','mb_scheduled_generate_mag_prices',null,null);
      		return null;
      	}
      }
      
      function errorHandler(err,_function,scriptName,sendEmail,user){
        	
        	var _subject = 'Error in '+_function+' in '+scriptName;
        	var _error = JSON.stringify(err)
        	log.error(_subject, _error);
        	
        	if (sendEmail ==true){
      			email.send({
      				author: user,
      				recipients : ['Lucas@mibar.net','netsuite@mibar.net','support@mibar.net'],
      				subject : _subject,
      				body : _subject+'. Details: '+_error
      			});
        	}
        };

      
      return {
          execute: execute
      };
});