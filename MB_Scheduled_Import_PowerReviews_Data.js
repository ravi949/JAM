/**
* @NApiVersion 2.x
* @NScriptType scheduledscript
* 
*/

define(
	[
		'N/https',
		// 'N/url',
		'N/search',
		'N/runtime',
		'N/email',
      	'N/task',
		// 'N/encode',
		'N/file',
		'N/sftp',
        'N/record'
	], 
	function(https,search,runtime,email,task,file,sftp,record) {

		function scheduled(body){
			try{
				const scriptParams = {
					// flowUrl : 'https://prod-164.westus.logic.azure.com:443/workflows/6932db3b434c4315aaa3562f1ddf15f4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fonsNmpIeUKtxRYvAfxZ2p3ZOiCtDVZegIpqm_SDF0A',
					sftpConfig : runtime.getCurrentScript().getParameter({name:'custscript_mb_pr_data_sftp'}),
					csvImportMapId : runtime.getCurrentScript().getParameter({name: 'custscript_mb_pr_csv_import_id'}),
					// {title:'FOLDERSCOM',id: runtime.getCurrentScript().getParameter({name: 'custscript_mb_power_reviews_fold'})},
					// {title:'ENVELOPESCOM', id: runtime.getCurrentScript().getParameter({name: 'custscript_mb_power_reviews_env'})}]//new Array()
				};
                scriptParams.filePath = '/MiBarData/Magento_to_NS/Product_Assets/Unprocessed';
                scriptParams.csvImportMapId = scriptParams.csvImportMapId;
                scriptParams.processedFilePath = '/MiBarData/Magento_to_NS/Product_Assets/Processed/';

                var sftpConnection = getSFTPConnection(scriptParams);
                log.debug('sftpConnection',sftpConnection);
                if(sftpConnection){
                    var files = getFiles(sftpConnection,scriptParams.filePath);
                    if(files){
                        for(var x=0; x<files.length;x++){
                            log.audit('File list Length',files.length);
                            var fileTest = files[x];
                            var fileName = files[x].name;
                            log.audit('Import file name',fileName);
                            var downloadedFile = downloadFile(sftpConnection,scriptParams.filePath,fileName);
                            log.debug('downloaded file',downloadedFile);
                            if(downloadedFile){
                                var csvTaskId = processCSVImport(downloadedFile,scriptParams.csvImportMapId);
                                log.audit('csvImport',csvTaskId);
                                var fileImported = checkCSVStatus(csvTaskId);
                                if(fileImported){
                                    var moveFileStatus = moveFile(sftpConnection,scriptParams.filePath,fileName,scriptParams.processedFilePath)
                                    log.audit('moveFileStatus',moveFileStatus);
                                }
                            }
                        }
                        
                    }

                }
                // getFiles(scriptParams);
				// postResults(scriptParams);
			} catch(err){
				log.error('Error in datain',JSON.stringify(err));   
				email.send({
					author: '1423',
					recipients : ['pramod@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Mag_PrdFeed_export',
					body : 'Please see the attached error: \n'+JSON.stringify(err),
				});
			}
					
		};

        function getFiles(sftpConnection,filePath,getSubfolders){
            try{
                if(sftpConnection){
                    var fileList = sftpConnection.list({
                        path : filePath,
                        sort : sftp.Sort.DATE_DESC
                    });
                    log.debug('first file', JSON.stringify(fileList[0]));
                    if(!getSubfolders){
                        fileList = fileList.filter(function(item,index){
                            if(item.directory){
                                return false;
                            }
                            return true;
                        });
                    };
                    log.debug('fileList',JSON.stringify(fileList));
                    return fileList;
                }
            }catch(err){
                log.error('Error getting files',err);
                return null;
            }
        };

        function downloadFile(sftpConnection,filePath,fileName){
            try{
                var downloadedFile = sftpConnection.download({
                    filename : fileName,
                    directory : filePath
                });

                return downloadedFile
            }catch(err){
                log.error('Error Downloading File',err);
                return null;
            }
        };

        function processCSVImport(fileObject,csvImportMap){
            try{

                if(fileObject){
                    fileObject.folder = '741';
                    var fileId = fileObject.save();
                    log.debug('saved file ID',fileId);
                };
                if(fileId){
                    var csvImportTask = task.create({
                        taskType : task.TaskType.CSV_IMPORT
                    });
                    csvImportTask.mappingId = csvImportMap;
                    csvImportTask.importFile = file.load({
                        id : fileId
                    });

                    var csvImportTaskId = csvImportTask.submit();
                    log.debug('csvImportTaskId', csvImportTaskId);
                    return csvImportTaskId;
                }
                // return 'success';

            }catch(err){[]
                log.error('Error processing CSV import',err);
                return null;
            }
        }

        function checkCSVStatus(csvTaskId){
            try{
                var csvTaskStatus = task.checkStatus({
                    taskId: csvTaskId
                });

                if (csvTaskStatus.status === task.TaskStatus.FAILED){
                    return false;
                } else {
                    return true;
                }

            }catch(err){
                log.error('Error Checking CSV Status',err);
                return null;
            }
        };

        function moveFile(sftpConnection,filePath,fileName,newFilePath){
            try{
                sftpConnection.move({
                    from : filePath+'/'+fileName,
                    to : newFilePath+fileName
                })
                return 'success';
            }catch(err){
                log.error('Error Moving File', err);
                return 'failure';
            }
        }


        function getSFTPConnection(scriptParams){
            try{

                var config = record.load({
                    type : 'customrecord_mbt_sftp_configuration',
                    id : scriptParams.sftpConfig
                });

                var configObject = {
                    sftpUserName : config.getValue({
                        fieldId : 'custrecord_mbt_sftp_username'
                    }),                    
                    sftpUrl : config.getValue({
                        fieldId : 'custrecord_mbt_sftp_remote_url'
                    }),
    
                    sftpPWGuid : config.getValue({
                        fieldId : 'custrecord_mbt_sftp_guid'
                    }),
    
                    sftpPort : config.getValue({
                        fieldId : 'custrecord_mbt_sftp_port'
                    }),
    
                    sftpHostKey : config.getValue({
                        fieldId : 'custrecord_mbt_sftp_host_key'
                    }),
    
                    sftpHostKeyType : config.getValue({
                        fieldId : 'custrecord_mbt_sftp_host_key_type'
                    })
                }
                configObject.sftpPort = configObject.sftpPort!='' && configObject.sftpPort!=null ? parseInt(configObject.sftpPort) : null
                log.debug('configObject', JSON.stringify(configObject));

                var sftpConnection = sftp.createConnection({
                    username: configObject.sftpUserName,
                    passwordGuid: configObject.sftpPWGuid,
                    url: configObject.sftpUrl,
                    // directory: '/',
                    port: configObject.sftpPort,
                    hostKey : configObject.sftpHostKey,
                    hostKeyType : configObject.sftpHostKeyType
                });

                return sftpConnection

            }catch(err){
                log.error('err in getSFTPConnection',err);
                return null;
            }
        }	
		
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
				log.error('err in scheduleScript',JSON.stringify(err));				//errorHandler(err,'scheduleScript','mb_scheduled_generate_mag_prices',null,null);
				return null;
			}
		}
        
        function searchGetResultObjects(_search,_start,_end){
        	try{
	        	var results;
	        	if (_start!=null && _end!=null){
	            	results = _search.run()//.getRange({
            		results = results.getRange({
	            		start : _start,
	            		end : _end
            		})

	            	//});
	        	} else {
	        		results = searchGetAllResult(_search);
	        	};
	        	log.debug('results',JSON.stringify(results));
	        	
	        	var columns = _search.columns;
	        	log.debug('columns',JSON.stringify(columns));
	
	        	var arrResults = new Array();
	        	
	        	log.debug('results.length',results.length);
	        	
	        	for (var k=0;k<results.length;k++){
	        		
					var tempObj = new Object();				
	        		var result = results[k];
	        		
					for (i=0;i<columns.length;i++){
						if(k==0){
							log.debug('column '+i,JSON.stringify(columns[i]));
							log.debug('column '+i+' value', result.getValue(columns[i]));
						};
						
						if (columns[i].hasOwnProperty('join')==false){
							columns[i].join=null;
						};
						if (columns[i].hasOwnProperty('summary')==false){
							columns[i].summary = null;
						}
						
						var propName = columns[i].label.replace(/ /g,"_");
						
						tempObj[propName] = result.getValue(columns[i]);
					};
					
//					tempArray.push(tempObj);
	        		arrResults.push(tempObj);
	        	};
	        	return arrResults;
        	} catch(err){
        		log.error('err in searchGetResultObjects',JSON.stringify(err));
				email.send({
					author: '1423',
					recipients : ['Pramod@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Item',
					body : 'Please see the attached error in the "dataIn" function: \n'+JSON.stringify(err),
				});
				return [];
        	}
        }
        
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
        
    return {
    	execute : scheduled
    }
});