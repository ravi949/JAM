/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/file','N/record','N/search',"N/runtime"],
		(file,record,search,runtime) => {
			const execute = (scriptContext) => {
				try {
					var legacyOrderFiles = ["299883"];
					var legacyOrderFileName = "SO Forms to Update.csv";
					var fileSearchObj = search.create({
						type: "file",
						filters:
							[
							 ["name","is",legacyOrderFileName]
							 ],
							 columns:
								 [
								  search.createColumn({
									  name: "name",
									  sort: search.Sort.ASC,
									  label: "Name"
								  }),
								  search.createColumn({name: "internalid", label: "Internal ID"})
								  ]
					});

					fileSearchObj.run().each(function(result){
						
						return true;
					});

					//var loop  = runtime.getCurrentScript().getParameter('custscript_mb_csv_file_loop');
					//var _file = legacyOrderFiles[Number(loop)-1];
					var fileObj = file.load({
						id : 515387
					});

					var contents = fileObj.getContents();
					var results = parseCsv(contents);
					log.debug("results",results);
					
					 var jsonData = createRowObjects(results);
					 log.debug("jsonData",jsonData);
					 log.debug("jsonData",jsonData.length);
					
					 updatLegacyOrders(jsonData);

				} catch (e) {
					log.error("Exception", e);
				}

			}
			
			const updatLegacyOrders = (results) =>{
				try{
					
					for(var i=0;i<results.length;i++){
						log.debug(i,results[i])
						var id = record.submitFields({
						    type: record.Type.SALES_ORDER,
						    id: results[i]["SO Internal ID"],
						    values: {
						    	customform: results[i]["Custom Form Internal ID"]
						    }
						});
						log.audit("id",id)
					}
					
				}catch(e){
					log.error("Exception in updating legacy Orders",e);
				}
				
			}
			
			 function createRowObjects(fileArray){
			        try{
			            log.debug('fileArray',fileArray);
			            var headers = fileArray[0];
			            log.debug('headers',headers)
			            fileArray.shift();
			            var rows = fileArray;
			            log.debug('rows',rows);
			            var tempArray = new Array();
			            for (var i=0;i<rows.length;i++){
			                var tempObj = new Object();
			                var row = rows[i];
			                for (var k=0;k<headers.length;k++){
			                    tempObj[headers[k]] = row[k]
			                };
			                tempArray.push(tempObj);
			                k=0;
			            };
			            return tempArray;
			        } catch(err){
			            log.error('error in createRowObjects',JSON.stringify(err));
			            return [];
			        }
			     }

			function parseCsv(csv_str) {

				var result = [];

				var line_end_index_moved = false;
				var line_start_index = 0;
				var line_end_index = 0;
				var csr_index = 0;
				var cursor_val = csv_str[csr_index];
				var found_new_line_char = get_new_line_char(csv_str);
				var in_quote = false;

				// Handle \r\n
				if (found_new_line_char == '\r\n') {
					csv_str = csv_str.split(found_new_line_char).join(new_line_char);
				}
				// Handle the last character is not \n
				if (csv_str[csv_str.length - 1] !== new_line_char) {
					csv_str += new_line_char;
				}

				while (csr_index < csv_str.length) {
					if (cursor_val === '"') {
						in_quote = !in_quote;
					} else if (cursor_val === new_line_char) {
						if (in_quote === false) {
							if (line_end_index_moved && (line_start_index <= line_end_index)) {
								result.push(parseCsvLine(csv_str.substring(line_start_index, line_end_index)));
								line_start_index = csr_index + 1;
							} // Else: just ignore line_end_index has not moved or line has not been sliced for parsing the line
						} // Else: just ignore because we are in a quote
					}
					csr_index++;
					cursor_val = csv_str[csr_index];
					line_end_index = csr_index;
					line_end_index_moved = true;
				}

				// Handle \r\n
				if (found_new_line_char == '\r\n') {
					var new_result = [];
					var curr_row;
					for (var i = 0; i < result.length; i++) {
						curr_row = [];
						for (var j = 0; j < result[i].length; j++) {
							curr_row.push(result[i][j].split(new_line_char).join('\r\n'));
						}
						new_result.push(curr_row);
					}
					result = new_result;
				}
				return result;
			}
			function get_new_line_char(csv_str) {
		         if (csv_str.indexOf('\r\n') > -1) {
		             return '\r\n';
		         } else {
		             return '\n'
		         }
		     }
			 function parseCsvLine(csv_line_str) {
				 
		         var result = [];
		 
		         //var field_end_index_moved = false;
		         var field_start_index = 0;
		         var field_end_index = 0;
		         var csr_index = 0;
		         var cursor_val = csv_line_str[csr_index];
		         var in_quote = false;
		 
		         // Pretend that the last char is the separator_char to complete the loop
		         csv_line_str += field_separator_char;
		 
		         while (csr_index < csv_line_str.length) {
		             if (cursor_val === '"') {
		                 in_quote = !in_quote;
		             } else if (cursor_val === field_separator_char) {
		                 if (in_quote === false) {
		                     if (field_start_index <= field_end_index) {
		                         result.push(parseCsvField(csv_line_str.substring(field_start_index, field_end_index)));
		                         field_start_index = csr_index + 1;
		                     } // Else: just ignore field_end_index has not moved or field has not been sliced for parsing the field
		                 } // Else: just ignore because we are in quote
		             }
		             csr_index++;
		             cursor_val = csv_line_str[csr_index];
		             field_end_index = csr_index;
		             var field_end_index_moved = true;
		         }
		         return result;
		     }
			 function parseCsvField(csv_field_str) {
		         var with_quote = (csv_field_str[0] === '"');
		 
		         if (with_quote) {
		             csv_field_str = csv_field_str.substring(1, csv_field_str.length - 1); // remove the start and end quotes
		             csv_field_str = csv_field_str.split('""').join('"'); // handle double quotes
		         }
		         return csv_field_str;
		     }
			
			const new_line_char = '\n';
		     const field_separator_char = ',';

			return { execute }

		});



