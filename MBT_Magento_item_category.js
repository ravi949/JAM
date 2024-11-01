/**
 * Script Name               : MBT_Magento_item_category.js
 * Script Author             : Sanath kumar.S
 * Script Type               : Restlet
 * Script Version            : 2.0
 * Script Created date       : 17/06/2022
 *
 * Script Last Modified Date : 21/06/2022
 * Script Last Modified By   : S.Sanath Kumar
 * Script Comments           : A Restlet to fetch the data from external system and create magento item categories custom record in netsuite
 * 
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/https', 'N/record', 'N/search','N/file','N/runtime','N/task'],
		/**
		 * @param {https} https
		 * @param {record} record
		 * @param {search} search
		 */

		function(https, record, search,file,runtime,task) {

	/**
	 * Definition of the Scheduled script trigger point.
	 *
	 * @param {Object} scriptContext
	 * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
	 * @Since 2015.2
	 */
	function execute(scriptContext)
	{
		log.debug("script","..................started...............");
		var remainingusage1  =  runtime.getCurrentScript().getRemainingUsage();

		log.debug("Get the goverenance at Beginning",remainingusage1);

		var error_array                      = [];
		var error_name                       ="";
		try
		{
			var scriptObj 		= runtime.getCurrentScript();
			var jsonindex 	  	= scriptObj.getParameter({name: 'custscript_mbt_json_index'});
			var dataindex       = scriptObj.getParameter({name: 'custscript_mbt_data_index'});


			var rescheduled_flag=false;
			if(jsonindex==null||dataindex==null)
			{
				log.error("Please enter script paramter values","Set those paramters to 0");
				return;
			}
			if(jsonindex!=null&&jsonindex==0&&dataindex!=null&&dataindex==0)
			{
				var url                              = "https://prod-174.westus.logic.azure.com/workflows/d418083a978b434db641769ed33774cb/triggers/manual/paths/invoke/getCategory/v1gl9ee4EW?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=L31uI1DWORwzxC5a_gXjshGlmKEse3gi8eD3WYEqnWQ";
				var contentRequest                   = https.get({url:url});
				log.debug("contentRequest",contentRequest);
				var response_code                    = contentRequest.code;
				var jsonarray                        = contentRequest.body;
				//var fileinternalid       =  84282;
				//var Json_fileObj         =  file.load({id: fileinternalid});
				//var jsonarray            =  Json_fileObj.getContents();

				var response_code                    =200;
				jsonindex                            = 0;
				dataindex                            = 0;
				log.debug("jsonindex",jsonindex);
				log.debug("dataindex",dataindex);
				error_array                          = [];

				var fileobj                          = file.create({name:"Item_Categories_JSON_Array.txt", fileType:file.Type.PLAINTEXT,contents:jsonarray});
				fileobj.folder = -15;
				var dataid                           = fileobj.save();
				log.debug("JSON Array File",dataid);
			}
			else
			{
				var json_filename        =  "Item_Categories_JSON_Array.txt";
				var json_fileid          =  getFileId(json_filename);
				log.debug("Get the previously saved JSON File content",json_fileid);

				var Json_fileObj         =  file.load({id: json_fileid});
				var jsonarray            =  Json_fileObj.getContents();
				rescheduled_flag         =  true;
				jsonindex                =  Number(jsonindex);
				dataindex                =  Number(dataindex);
				log.debug("jsonindex",jsonindex);
				log.debug("dataindex",dataindex);

				var error_filename       =  "Item_Categories_Error_file.txt";
				var errorfileid          =  getFileId(error_filename);
				log.debug("Error file id of previous schedule",errorfileid);
				var error_array_file     =  file.load({id: errorfileid});
				error_array          =  error_array_file.getContents();
				error_array          =  JSON.parse(error_array);
				log.debug("error_array",error_array);
			}

			if(response_code=='200'||rescheduled_flag==true)
			{
				jsonarray=JSON.parse(jsonarray);
				log.debug("JSON's length",jsonarray.length);

				for(var q=jsonindex;q<jsonarray.length;q++)
				{
					var headers                          = jsonarray[q]["headers"];
					headers                              = headers.split("|");
					var headers_length                   = headers.length;
					log.debug("headers",headers);
					var data                             = jsonarray[q]["data"];

					log.debug("Data length in JSON:"+q,data.length);
					var error_flag=false;
					var entityid_position                = headers.indexOf('custrecord_mb_mag_entity_id_2');
					if(entityid_position!=-1)
					{
						var entity_value_array=[];
						for(var s=0;s<data.length;s++)
						{
							try
							{
								var current_row                      = data[s].split("|");
								log.debug("current_row",current_row);
								var current_row_length=current_row.length;
								if(current_row_length==headers_length)
								{
									var entity_id=current_row[entityid_position];
									log.debug("entity_id at row number:"+s,entity_id);
									entity_id=entity_id.trim();
									if(entity_id!="")
										entity_value_array.push(entity_id);
								}
							}
							catch(e)
							{
								log.error(e.name,e.message);
							}
						}

						var Filters_array=[];
						var Entity_Filter_arr=[];
						Entity_Filter_arr.push(["isinactive","is","F"]);
						Entity_Filter_arr.push("AND");
						try
						{
							for(var s=0;s<entity_value_array.length;s++)
							{
								if(s==0)
								{
									Entity_Filter_arr.push(["custrecord_mb_mag_entity_id_2","equalto",entity_value_array[s]]);
								}
								else
								{
									Entity_Filter_arr.push("OR");
									Entity_Filter_arr.push(["custrecord_mb_mag_entity_id_2","equalto",entity_value_array[s]]);
								}
							}
							Filters_array.push(Entity_Filter_arr);
							log.debug("Filters_array",Filters_array);
							var customrecord_mb_magento_categoriesSearchObj = search.create({
								type: "customrecord_mb_magento_categories_2",
								filters:Filters_array,
								columns:
									[
									 search.createColumn({name: "custrecord_mb_mag_entity_id_2", label: "Magento Entity ID"}),
									 search.createColumn({name: "internalid", label: "Internal ID"})
									 ]
							});

							var searchResultCount = customrecord_mb_magento_categoriesSearchObj.runPaged().count;
							log.debug("result count",searchResultCount);

							var Entity_internal_obj={};

							customrecord_mb_magento_categoriesSearchObj.run().each(function(result){
								var internal_id     = result.getValue({name: "internalid", label: "Internal ID"});
								var Entity_id       = result.getValue({name: "custrecord_mb_mag_entity_id_2", label: "Magento Entity ID"});

								Entity_internal_obj[Entity_id]=internal_id;
								return true;
							});

							log.debug("Entity_internal_obj",Entity_internal_obj);
						}
						catch(e)
						{
							log.error(e.name,e.message);
						}


						for(var i=dataindex;i<data.length;i++)
						{
							try
							{
								var remainingusage  =  runtime.getCurrentScript().getRemainingUsage();
								log.debug("remainingusage",remainingusage);
								if(Number(remainingusage)<200)
								{
									var errorfile_obj    = file.create({name:"Item_Categories_Error_file.txt", fileType:file.Type.PLAINTEXT,contents:JSON.stringify(error_array)});
									errorfile_obj.folder = -15;
									var error_fileid     = errorfile_obj.save();
									log.debug("Errors file during reschedule",error_fileid);

									var status=rescheduleCurrentScript(q,i);
									return;
								}
								var current_row                      = data[i].split("|");
								log.debug("current_row",current_row);

								var current_row_length                     = current_row.length;

								var entity_id=current_row[entityid_position];
								log.debug("entity_id at row number"+i,entity_id);

								if(current_row_length==headers_length)
								{
									if(entity_id!=""&&entity_id!=null&&entity_id!=undefined)
									{
										if(Entity_internal_obj.hasOwnProperty(entity_id))
										{
											var magento_Categories_internal_id     = Entity_internal_obj[entity_id];
											var new_magento_Categories             = record.load({type:'customrecord_mb_magento_categories_2',id:magento_Categories_internal_id});
										}
										else
										{
											var new_magento_Categories             = record.create({ type:'customrecord_mb_magento_categories_2'});
										}


										for(var d=0;d<headers_length;d++)
										{
											var req_fieldId                    = headers[d];

											//	log.debug("fieldid",req_fieldId);

											var value                          = current_row[d];
											//  log.debug("value",value);

											var currentfieldtype                  = new_magento_Categories.getField({fieldId: req_fieldId});

											if(currentfieldtype!=null&&currentfieldtype!=undefined&&currentfieldtype!="")
												currentfieldtype=currentfieldtype.type;

											if(currentfieldtype=='checkbox')
											{
												if(value=='True'||value=='true')
													value=true;
												else if(value=='False'||value=='false')
													value=false;
											}

											new_magento_Categories.setValue({fieldId:req_fieldId,value:value});
										}
										var recordId                           = new_magento_Categories.save();

										log.debug("recordId",recordId);
									}
									else
									{
										var errorobj={"name":"MISSING MANDATORY VALUE","message":"Missing mandatory field value for the field Magento Entity Id"};

										throw errorobj;
									}
								}
								else
								{
									var errorobj={"name":"PARSE ERROR","message":"Number of columns in current row did not match with number of headers"};

									throw errorobj;
								}
							}
							catch(e)
							{
								error_flag=true;
								log.error(e.name,e.message);

								var today = new Date();
								error_name=e.name;

								var errorjson={};

								if(error_name="MISSING MANDATORY VALUE")
								{
									var error_occured_json=q+1;
									var error_occured_row=i+1;
									errorjson["errorDate"]=today;
									errorjson["errorFile"]="category";
									errorjson["rownumber"]="File-"+error_occured_json+",Row Number-"+error_occured_row;
									errorjson["error"]=e.message;
									log.debug("errorjson",errorjson);
								}
								else
								{
									errorjson["errorDate"]=today;
									errorjson["errorFile"]="category";
									errorjson["recordIdentifier"]=entity_id;
									errorjson["error"]=e.message;
									log.debug("errorjson",errorjson);
								}

								error_array.push(errorjson);
							}
						}
					}
					else
					{
						var errorobj={"name":"MISSING MANDATORY HEADER","message":"Missing a mandatory header 'custrecord_mb_mag_entity_id_2'"};

						throw errorobj;
					}
				}
			}
			else
			{
				var error=contentRequest["body"];
				error=JSON.parse(error);
				error=error["error"]["message"];
				log.debug("error",error);
				var errorobj={"name":"REQUEST ERROR","message":error};

				throw errorobj;
			}
		}
		catch(e)
		{
			log.error(e.name,e.message);

			var today = new Date();
			var errorjson={};
			error_name=e.name;
			if(error_name=="MISSING MANDATORY HEADER"||error_name=="REQUEST ERROR")
			{
				errorjson["errorDate"]=today;
				errorjson["errorFile"]="category";
				errorjson["recordIdentifier"]="";
				errorjson["error"]=e.message;
				log.debug("errorjson",errorjson);
				error_array.push(errorjson);
				log.debug("error_array",error_array);
			}
			else
			{
				errorjson["errorDate"]=today;
				errorjson["errorFile"]="category";
				errorjson["recordIdentifier"]="";
				errorjson["error"]=e.message;
				log.debug("errorjson",errorjson);
				error_array.push(errorjson);
				log.debug("error_array",error_array);
			}
		}

		try
		{
			log.debug("***********Final error_array***********",error_array);
			log.debug("End of script execution","Done");
			var return_url="https://prod-158.westus.logic.azure.com/workflows/f6c4ad317ccb4dbcb355abb6c933c3e4/triggers/manual/paths/invoke/errorHandler/W8UTbOLbs2?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=c9qMzXaap7gNinEZqn9LQu_sWTz_VDn3xy5Jbt85nkE";

			var errorfile_obj2    = file.create({name:"FinalErrorfile.txt", fileType:file.Type.PLAINTEXT,contents:JSON.stringify(error_array)});
			errorfile_obj2.folder = 1074;
			var error_fileid2     = errorfile_obj2.save();
			log.debug("Errors file at end",error_fileid2);

			var return_response=https.post({
				url: return_url,
				body: JSON.stringify(error_array)
			});
			log.debug("Return_response",return_response["code"]);
		}
		catch(e)
		{
			log.error("Error while posting errors:"+e.name,e.message);
		}
	}
	function rescheduleCurrentScript(jsonindex,dataindex)
	{
		log.debug("Retriggered","true");
		var scheduledScriptTask=task.create({
			taskType: task.TaskType.SCHEDULED_SCRIPT
		});

		scheduledScriptTask.scriptId=runtime.getCurrentScript().id;
		scheduledScriptTask.deploymentId = runtime.getCurrentScript().deploymentId;
		scheduledScriptTask.params = {
				'custscript_mbt_json_index' : jsonindex,
				'custscript_mbt_data_index' : dataindex
		};
		return scheduledScriptTask.submit();
	}
	function getFileId(filename){
		var file_id     =  search.create({type: 'folder',filters:[{name: 'name',join:'file',operator: 'is',values: filename}],
			columns: [{name: 'internalid',join:'file'}]
		});

		var searchresult = file_id.run().getRange({start: 0,end: 1});
		//log.debug('searchlength is',searchresult.length);

		for(var i=0;i<searchresult.length;i++)
		{
			var fileId = searchresult[i].getValue({name: "internalid", join: "file"});
			//log.debug("fileId",fileId);
		}

		return fileId;
	}

	return {
		execute: execute
	};

});