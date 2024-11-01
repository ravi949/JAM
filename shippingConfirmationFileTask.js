/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

/**
 * Script Type          : ScheduledScript
 * Script Name          : Shipping Confirmation File Task
 * Version              : 2.1
 * Author               : A.Bhargavi
 * Start Date           : 02 Feb 2022
 * Last Modified Date   : 
 * Description          : 
 * 							
 */
var transactionTypeMapping = {
    "Sales Order": "SalesOrd",
    "Invoice": "CustInvc"
}
define(['N/search', 'N/record', 'N/file', 'N/https', 'N/task', 'N/runtime'],

    function(search, record, file, https, task, runtime) {

        function execute(scriptContext) {
            try {
                var token = "qeRQruVCff"
                var endPoint = "https://prod-06.westus.logic.azure.com/workflows/ae3b12edd8db461ab090ac5627b1317b/triggers/manual/paths/invoke/SendConfirmationFile/qeRQruVCff?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=KGUekezp377ToM04SHql8NQ1KG_p-I9to-ZGHOkT6XU"
                var testFolder = runtime.getCurrentScript().getParameter({
                    name: 'custscript_mb_test_folder'
                });
              	var fireWB = runtime.getCurrentScript().getParameter({
                  name : 'custscript_mb_only_wb_856'
                });
              	var filters;
              	if(fireWB== '206' || fireWB == '540'){
                      _filters =    [
        					["isinactive","is","F"], 
        					"AND", 
        					["internalid","anyof",fireWB ]
     					]
                } else {
                  _filters =    [
                        ["isinactive","is","F"], 
                        "AND", 
                        ["internalid","noneof","206"],
                        "AND",
                        ["internalid","noneof",'540']
                      ]
                };

                var fileTypeObject = {
                    '.txt': 'PLAINTEXT',
                    '.csv': 'CSV',
                    '.xlsx': 'EXCEL'
                }
                var delimeterObj = {
                    'Tab': '\t',
                    ',': ',',
                    '|': '|'
                }
                var internalIdArray = new Array();
                var merchantIdArray = new Array();
                
                var result = anotherDeploymentIsExecuting();
                if(result.length > 0 && (fireWB!='206' && fireWB!='540')) {
                    log.error("Process Terminated", "The script thats marks the proccessed records is currently in" + result[0].getValue('status') + ". Please try again in sometime.");
                    return;
                };


                var customrecord_mb_channel_fileSearchObj = search.create({
                    type: "customrecord_mb_channel_file",
                    filters: _filters,
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_file_name",
                            label: "File Name"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_channel",
                            label: "Channel"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_channel_identifier",
                            label: "Channel Identifier"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_file_type",
                            label: "Type"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_edi_provider",
                            label: "EDI Provider"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_file_type_extension",
                            label: "File Extension"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_file_identifier",
                            label: "File Identifier"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_delimiter",
                            label: "Delimiter"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_had_header_row",
                            label: "Has Header Row"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_cf_post_to_ftp",
                            label: 'Post to FTP'
                        }),
                        search.createColumn({
                            name: "name",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Name"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_row_number",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Row Number",
                            sort: search.Sort.ASC
                        })
                        /*,
                        					  search.createColumn({
                        						name: "custrecord_mb_create_order",
                        						join: "CUSTRECORD_MB_FILE",
                        						label: "Create Order",
                        						sort : search.Sort.ASC
                        					  })*/
                        ,
                        search.createColumn({
                            name: "custrecord_mb_saved_search_id",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Saved Search ID"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_is_header_row",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Is Header Row"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_join",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Join"
                        }),
                        search.createColumn({
                            name: "custrecord__mb_insert_duplicates",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Join"
                        })
                    ]
                });
                var resultSet = customrecord_mb_channel_fileSearchObj.run();
                var searchResult = new Array();
                var tempCondition = 111;
                var id = 0;
                do {
                    var resultslice = resultSet.getRange(id, id + 1000);
                    if(resultslice != null && resultslice != '') {
                        for(var rs in resultslice) {
                            searchResult.push(resultslice[rs]);
                            id++;
                        }
                    }
                }
                while((resultslice != null) ? resultslice.length >= 1000 : tempCondition < 0);
                log.debug('searchResult length is:', searchResult.length);
                if(searchResult.length > 0) {
                    var jsonArray = [];
                    for(var i = 0; i < searchResult.length; i++) {
                        log.debug('searchResult length is:', searchResult[i]);
                        var jsonData = {};
                        var channelId = searchResult[i].getValue({
                            name: "internalid"
                        });
                        log.debug('channelId is', channelId)
                        jsonData["channelId"] = channelId || '';
                        var ChannelFileName = searchResult[i].getValue({
                            name: "custrecord_mb_file_name"
                        });
                        log.emergency('ChannelFileName is', ChannelFileName)
                        jsonData["ChannelFileName"] = ChannelFileName || '';
                        var channel = searchResult[i].getValue({
                            name: "custrecord_mb_channel"
                        });
                        log.debug('channel id is', channel)
                        jsonData["channel"] = channel || '';
                        var channelIdentifier = searchResult[i].getValue({
                            name: "custrecord_mb_channel_identifier"
                        });
                        log.debug('channelIdentifier id is', channelIdentifier)
                        jsonData["channelIdentifier"] = channelIdentifier || '';
                        var fileType = searchResult[i].getValue({
                            name: "custrecord_mb_file_type"
                        });
                        log.debug('fileType id is', fileType)
                        jsonData["fileType"] = fileType || '';
                        var ediProvider = searchResult[i].getValue({
                            name: "custrecord_mb_edi_provider"
                        });
                        log.debug('ediProvider id is', ediProvider)
                        jsonData["ediProvider"] = ediProvider || '';
                        var fileExtension = searchResult[i].getValue({
                            name: "custrecord_mb_file_type_extension"
                        });
                        log.debug('fileExtension id is', fileExtension)
                        jsonData["fileExtension"] = fileExtension || '';
                        var fileIdentifier = searchResult[i].getValue({
                            name: "custrecord_mb_file_identifier"
                        });
                        log.debug('fileIdentifier id is', fileIdentifier)
                        jsonData["fileIdentifier"] = fileIdentifier || '';
                        var delimeter = searchResult[i].getValue({
                            name: "custrecord_mb_delimiter"
                        });
                        log.debug('delimeter id is', delimeter)
                        jsonData["delimeter"] = delimeter || '';
                        var headerRow = searchResult[i].getValue({
                            name: "custrecord_mb_had_header_row"
                        });
                        log.debug('headerRow id is', headerRow)
                        jsonData["headerRow"] = headerRow || '';
                        var postToFTP = searchResult[i].getValue({
                            name: 'custrecord_mb_cf_post_to_ftp'
                        });
                        log.debug('postToFtp', postToFTP);
                        jsonData["postToFTP"] = postToFTP || '';
                        var fileRowName = searchResult[i].getValue({
                            name: "name",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Name"
                        })
                        log.debug('fileRowName id is', fileRowName)
                        jsonData["fileRowName"] = fileRowName || '';
                        var fileRowNumber = searchResult[i].getValue({
                            name: "custrecord_mb_row_number",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Row Number"
                        });
                        log.debug('fileRowNumber is', fileRowNumber)
                        jsonData["fileRowNumber"] = fileRowNumber || '';
                        var savedSearchId = searchResult[i].getValue({
                            name: "custrecord_mb_saved_search_id",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Saved Search ID"
                        });
                        log.debug('savedSearchId is', savedSearchId)
                        jsonData["savedSearchId"] = savedSearchId || '';
                        var isHeaderRow = searchResult[i].getValue({
                            name: "custrecord_mb_is_header_row",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Is Header Row"
                        });
                        log.debug('isHeaderRow is', isHeaderRow)
                        jsonData["isHeaderRow"] = isHeaderRow || '';
                        var join = searchResult[i].getValue({
                            name: "custrecord_mb_join",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Join"
                        });
                        log.debug('join id is', join)
                        jsonData["join"] = join || '';
                        var doNotInsertDuplicates = searchResult[i].getValue({
                            name: "custrecord__mb_insert_duplicates",
                            join: "CUSTRECORD_MB_FILE",
                            label: "Join"
                        });
                        log.debug('doNotInsertDuplicates', doNotInsertDuplicates)
                        jsonData["doNotInsertDuplicates"] = doNotInsertDuplicates || '';
                        log.debug("jsonData", jsonData);
                        jsonArray.push(jsonData);
                    }
                    log.debug("jsonArray", jsonArray);

                    if(jsonArray.length > 0) {

                        //Grouping the results by the channel id.
                        var groupBy = (array, key) => {
                            return array.reduce((result, currentValue) => {
                                (result[currentValue[key]] = result[currentValue[key]] || []).push(
                                    currentValue
                                );
                                return result;
                            }, {});
                        };
                        var fileRowGroupedByChannelId = groupBy(jsonArray, 'channelId');
                        log.emergency("fileRowGroupedByChannelId", fileRowGroupedByChannelId);



                        {
                            //	var counter  = 0;
                            var contents = '';

                            //Looping through every channel.
                            var finalArrayOfRows = [];
                            var finalInternalIds = [];
                            for(channelId in fileRowGroupedByChannelId) {
                                log.emergency("channelId", channelId);
                                var channelDetails = fileRowGroupedByChannelId[channelId];

                                var fieldLookUp = search.lookupFields({
                                    type: 'customrecord_mb_channel_file',
                                    id: channelId,
                                    columns: ['custrecord_mb_file_name', 'custrecord_mb_cf_post_to_ftp', 'custrecord_mb_channel_identifier', 'custrecord_mb_file_identifier']
                                });
                                log.emergency("fieldLookUp", fieldLookUp);
                                var mainChannelFileName = fieldLookUp.custrecord_mb_file_name;
                                var channelPushToFTP = fieldLookUp.custrecord_mb_cf_post_to_ftp;
                                var channelName = fieldLookUp.custrecord_mb_channel_identifier;
                                var channelFileType = fieldLookUp.custrecord_mb_file_identifier;


                                var fileTypeV = '';
                                var fileExtension = '';
                                var headers = new Array();
                                var finalHeader = '';
                                var contents = '';
                                var channelFileName = '';
                                var delimiter = '';
                                var joinSearchIdArray = new Array();
                                var joinTransactionArray = new Array();
                                var joinDuplicationArray = new Array();
                                var fileRowSearchOjects = {};
                                var fileRowSearchArray = [];



                                //if(counter ==0){
                                // Looping through all the searches in the channel.
                                // filter to prevent detail rows without header from being passed;
                                var internalIdFilterArray = new Array();
                                channelDetails.forEach((element, i) => {
                                    delimiter = delimeterObj[element['delimeter']];
                                    fileExtension = element['fileExtension'];
                                    fileTypeV = fileTypeObject[element['fileExtension']];
                                    var searchId = element['savedSearchId'];
                                    var isHeaderRow = element['isHeaderRow'];
                                    channelFileName = element['ChannelFileName'];
                                    var joinTransaction = element['join'];
                                    var doNotInsertDuplicates = element['doNotInsertDuplicates'];
                                    log.debug("doNotInsertDuplicates", doNotInsertDuplicates);
                                    log.debug("delimiter=====fileType ==== joinTransaction", delimiter + '====' + fileTypeV, +'======' + joinTransaction);


                                    /*
                                    if i == 0, store internal ids to add as a filter for the subsequent searches
                                    
                                    */
                                    if(searchId != null && searchId != undefined && searchId != '') {
                                        var loadSavedSearch = search.load({
                                            id: searchId
                                        });
                                        var columns = loadSavedSearch.columns;
                                        log.audit('column length: ' + columns.length + ' for ' + channelFileName, JSON.stringify(columns));
                                        var filtersArray = loadSavedSearch.filters;
                                        // add new filter to detail saved searches;
                                        if(i!=0 && internalIdFilterArray.length>0){
                                            var internalIdFilter = search.createFilter({
                                                name : 'internalid',
                                                operator : search.Operator.ANYOF,
                                                values : internalIdFilterArray
                                            });
                                            loadSavedSearch.filters.push(internalIdFilter)
                                        }
                                        /*var filterOne 		= search.createFilter({ 
                                        	name	 : 'type',
                                        	operator : search.Operator.ANYOF,
                                        	values	 : ["ItemShip"]
                                        });
                                        filtersArray.push(filterOne);*/

                                        if(joinTransaction) {
                                            joinSearchIdArray.push(searchId);
                                            joinTransactionArray.push(joinTransaction);
                                            joinDuplicationArray.push(doNotInsertDuplicates);
                                        }


                                        if(isHeaderRow == true || isHeaderRow == 'true') {
                                            for(var i = 0; i < columns.length; i++) {
                                                headers[i] = columns[i].label;
                                            }
                                            headers = headers.join(delimiter);
                                        }

                                        var resultSet = loadSavedSearch.run();
                                        var searchResult = new Array();
                                        var tempCondition = 111;
                                        var id = 0;
                                        do {
                                            var resultslice = resultSet.getRange(id, id + 1000);
                                            if(resultslice != null && resultslice != '') {
                                                for(var rs in resultslice) {
                                                    searchResult.push(resultslice[rs]);
                                                    id++;
                                                }
                                            }
                                        } while((resultslice != null) ? resultslice.length >= 1000 : tempCondition < 0);


                                        if(searchResult.length > 0) {
                                            var indArrayOfRows = [];
                                            for(var n = 0; n < searchResult.length; n++) {
                                                var temp = new Array();
                                                var internalId = 0;
                                                for(var y = 0; y < columns.length; y++) {
                                                    internalId = searchResult[n].getValue('internalid');
                                                    //push internal id filter if it's the first row;
                                                    if(i==0){
                                                        internalIdFilterArray.push(internalId);
                                                    }
                                                    var columnsData = searchResult[n].getValue(resultSet.columns[y]);
                                                    temp[y] = columnsData || null;
                                                }
                                                indArrayOfRows.push(temp)

                                            }
                                        }
                                        if(indArrayOfRows && indArrayOfRows.length > 0) {
                                            if(doNotInsertDuplicates == 'T' || doNotInsertDuplicates == true || doNotInsertDuplicates == 'true') {
                                                var uniqueContent = removeDuplicates(indArrayOfRows, delimiter, finalInternalIds);
                                                fileRowSearchArray = fileRowSearchArray.concat(uniqueContent);
                                                log.audit("uniqueContent", uniqueContent);
                                            } else {
                                                indArrayOfRows.forEach(function(part, index) {
                                                    finalInternalIds.push(part[0]);
                                                    fileRowSearchArray.push(part.join(delimiter));
                                                });
                                            }
                                        }
                                        if(joinTransaction) {
                                            joinSearchResults(searchId, joinTransaction, delimiter, fileRowSearchArray, doNotInsertDuplicates, finalInternalIds)
                                        }
                                    }

                                });

                                log.debug('fileRowSearchArray', fileRowSearchArray);
                                log.debug('finalInternalIds', finalInternalIds);
                                //	log.debug('fileRowSearchOjects',fileRowSearchOjects);
                                var joinFileRowSearchOjects = [];
                                /*var joinTransactionsInternalIds = new Array();
                                for(var l = 0; l < joinSearchIdArray.length; l++) {

                                    var joinContent = [];
                                    var joinTranIds = [];
                                    var response = joinSearchResults(joinSearchIdArray[l], joinTransactionArray[l], delimiter, joinFileRowSearchOjects)
                                    response = response ? JSON.parse(response) : {};
                                    joinTranIds = response["idArray"];
                                    joinTransactionsInternalIds = joinTransactionsInternalIds.concat(joinTranIds);
                                }

                                var finalTranIds = joinTransactionsInternalIds.concat(internalIdArray);*/
                                var uniqueArray = finalInternalIds.filter(function(item, pos) {
                                    return finalInternalIds.indexOf(item) == pos;
                                });
                                //	log.audit("uniqueArray",uniqueArray);

                                var content = [];
                                for(var contentArray in fileRowSearchArray) {

                                    content = content.concat(fileRowSearchArray[contentArray])
                                }
                                var contentObject = {}
                                for(var l = 0; l < content.length; l++) {
                                    var internalId = (content[l].split(delimiter))[0]

                                    if(contentObject.hasOwnProperty(internalId)) {
                                        var existingContent = contentObject[internalId];
                                        existingContent.push(content[l])
                                        contentObject[internalId] = existingContent
                                    } else {
                                        contentObject[internalId] = [content[l]]
                                    }

                                }
                                log.audit("contentObject", contentObject);
                                var content = [];

                                for(var x in contentObject) {

                                    content = content.concat(contentObject[x])
                                }
                                log.audit("content", content);

                                if(content.length > 0) {

                                    for(var z = 0; z < content.length; z++) {
                                        contents += content[z] + '\n';
                                    }

                                    // To remove internalId from the contents.
                                    var finalContents = '';
                                    contents = contents.split('\n');

                                    for(var s = 0; s < contents.length; s++) {
                                        var contentArray = contents[s].split(delimiter);
                                        contentArray.shift();
                                        contentArray = contentArray.join(delimiter);
                                        if(s != contents.length - 1) finalContents += contentArray + '\n';
                                    }

                                    //Variable for datetime
                                    var date = new Date();
                                    if(headers != '') {
                                        finalHeader = headers.split(delimiter);
                                        finalHeader.shift();
                                        headers = finalHeader.join(delimiter);
                                        headers = headers.toString() + '\n'
                                    };


                                    //Creation of file

                                    let d = new Date();
                                    var month = d.getMonth() + 1;
                                    var day = d.getDate();
                                    var finalFileNameFormat = mainChannelFileName + '_' + (month > 9 ? month : '0' + month) + (day > 9 ? day : '0' + day) + (d.getFullYear()) + '_' + (d.getHours()) + '_' + (d.getMinutes()) + '_' + (d.getSeconds()) + fileExtension;

                                    var fileObj = file.create({
                                        name: finalFileNameFormat,
                                        fileType: fileTypeV,
                                        contents: headers + finalContents,
                                        description: 'This is a CSV file.',
                                        encoding: file.Encoding.UTF8,
                                        folder: testFolder
                                    });
                                    var fileId = fileObj.save()
                                    /*							var channelPushToFTP = fieldLookup.custrecord_mb_cf_post_to_ftp;
                                    						var channelName = fieldLookup.custrecord_mb_channel_identifier;
                                    						var channelFileType = fieldLookup.custrecord_mb_file_identifier;
                                    */

                                    var response = https.post({
                                        url: endPoint,
                                        body: JSON.stringify({
                                            contents: fileObj.getContents(),
                                            name: finalFileNameFormat,
                                            pushToFTP: channelPushToFTP,
                                            channelName: channelName,
                                            channelFileType: channelFileType
                                        })
                                    });
                                    log.audit("response", response);

                                    //counter++;
                                    //	}
                                }
                            }
                            var mrTask = task.create({
                                taskType: task.TaskType.MAP_REDUCE,
                                scriptId: 'customscript_tss_mr_processed_checkbox',
                              //  deploymentId: 'customdeploy_tss_mr_processed_checkbox',
                                params: {
                                    custscript_tss_internalid_array: JSON.stringify(uniqueArray)
                                }
                            });
                            mrTaskId = mrTask.submit();
                            log.debug('mr task id', mrTaskId)


                        }
                    }
                }



            } catch (e) {
                log.error('Error in SS Shipping confirmaation file task execute', e);
            }
        }

        function removeDuplicates(indArrayOfRows, delimiter, finalInternalIds) {
            try {
                log.debug("indArrayOfRows", indArrayOfRows);
                var unformattedArray = [];
                var internalIdsUnformatted = [];
                var finalContent = [];
                for(var i = 0; i < indArrayOfRows.length; i++) {
                    internalIdsUnformatted.push(indArrayOfRows[i].shift())
                    unformattedArray.push(indArrayOfRows[i].join(delimiter))
                }

                log.debug("unformattedArray", unformattedArray);
                log.debug("unformattedArray", [...new Set(unformattedArray)]);
                var formattedArray = [...new Set(unformattedArray)];
                finalInternalIds = finalInternalIds.concat(internalIdsUnformatted)
                for(var j = 0; j < formattedArray.length; j++) {
                    var parsedContent = formattedArray[j];
                    log.debug("parsedContent", parsedContent);
                    var index = unformattedArray.indexOf(parsedContent);
                    log.debug('indexOf', index)
                    finalContent.push([internalIdsUnformatted[index], parsedContent].join(delimiter));
                }
                return finalContent;
            } catch (e) {
                log.error("Exception in Remove Duplicates", e);
            }
        }

        function joinSearchResults(searchId, type, delimiter, joinFileRowSearchOjects, doNotInsertDuplicates, finalInternalIds) {
            try {

                var loadSavedSearch = search.load({
                    id: searchId
                });
                var columns = loadSavedSearch.columns;
                var filtersArray = loadSavedSearch.filters;

                var filterOne = search.createFilter({
                    name: 'type',
                    operator: search.Operator.ANYOF,
                    values: transactionTypeMapping[type]
                });
                filtersArray.push(filterOne);
                /*var filterTwo 		= search.createFilter({ 
                	name	 : 'internalid',
                	operator : search.Operator.ANYOF,
                	values	 : ["9162819","9162918"]
                });
                filtersArray.push(filterTwo); */
                log.debug("filtersArray", filtersArray)

                var resultSet = loadSavedSearch.run();
                var searchResult = new Array();
                var tempCondition = 111;
                var id = 0;
                do {
                    var resultslice = resultSet.getRange(id, id + 1000);
                    if(resultslice != null && resultslice != '') {
                        for(var rs in resultslice) {
                            searchResult.push(resultslice[rs]);
                            id++;
                        }
                    }
                } while((resultslice != null) ? resultslice.length >= 1000 : tempCondition < 0);

                var content = new Array();
                var internalIdArray = new Array();

                log.debug("searchResult join", searchResult.length)
                if(searchResult.length > 0) {
                    var indArrayOfRows = [];
                    for(var n = 0; n < searchResult.length; n++) {
                        var temp = new Array();
                        for(var y = 0; y < columns.length; y++) {
                            var internalId = searchResult[n].getValue('internalid');

                            var columnsData = searchResult[n].getValue(resultSet.columns[y]);
                            temp[y] = columnsData || '';
                        }
                        indArrayOfRows.push(temp)
                    }
                    if(indArrayOfRows && indArrayOfRows.length > 0) {
                        if(doNotInsertDuplicates == 'T' || doNotInsertDuplicates == true || doNotInsertDuplicates == 'true') {
                            var uniqueContent = removeDuplicates(indArrayOfRows, delimiter, finalInternalIds);
                            joinFileRowSearchOjects = joinFileRowSearchOjects.concat(uniqueContent);
                            log.audit("uniqueContent", uniqueContent);
                        } else {
                            indArrayOfRows.forEach(function(part, index) {
                                finalInternalIds.push(part[0]);
                                joinFileRowSearchOjects.push(part.join(delimiter));
                            });
                        }
                    }
                }

                return JSON.stringify({
                    "content": content,
                    "idArray": internalIdArray
                })


            } catch (e) {
                log.error("Exception in Join Search Results", e);
            }
        }

        function anotherDeploymentIsExecuting() {
            var ss = search.create({
                type: record.Type.SCHEDULED_SCRIPT_INSTANCE,
                filters: [
      ["script.internalid","anyof","948"], 
      "AND", 
      ["status","anyof","PENDING","PROCESSING"], 
      "AND", 
      ["scriptdeployment.internalid","noneof","4770"]
   ],
                columns: ["status", "script.internalid"]
            }).run().getRange(0, 1);

            return ss;
        }

        return {
            execute: execute
        };

    });