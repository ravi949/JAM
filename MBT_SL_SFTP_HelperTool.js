var HTTPSMODULE, SFTPMODULE, SERVERWIDGETMODULE;
var HOST_KEY_TOOL_URL = 'https://ursuscode.com/tools/sshkeyscan.php?url=';
 
/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define(["N/https", "N/sftp", "N/ui/serverWidget"], runSuitelet);
 
function runSuitelet(https, sftp, serverwidget){
try{
    HTTPSMODULE= https;
    SERVERWIDGETMODULE= serverwidget;
    SFTPMODULE= sftp;
    
	var returnObj = {};
	returnObj.onRequest = execute;
	return returnObj;
}catch(e){
    log.error("Error in runSuitelet",e)
}
}
 
function execute(context){
    try{
    var method = context.request.method;
    
  	var form = getFormTemplate(method);
    
    if (method == 'GET') {
        form = addSelectorFields(form);
    }
    
    if (method == 'POST') {
        var selectaction = context.request.parameters.selectaction;
        if(selectaction == 'getpasswordguid'){
            form = addPasswordGUID1Fields(form);
            
        }
        else if(selectaction == 'gethostkey'){
            form = addHostKeyFields(form);
        }
        else if(selectaction == 'downloadfile'){
            form = addDownloadFileFields(form);
        } else {
            var password = context.request.parameters.password;
            var username = context.request.parameters.username;
            var passwordGuid = context.request.parameters.passwordguid;
            var url = context.request.parameters.url;
            var hostKey = context.request.parameters.hostkey;
            var hostKeyType = context.request.parameters.hostkeytype;
            var port = context.request.parameters.port;
            var directory = context.request.parameters.directory;
            var timeout = context.request.parameters.timeout;
            var filename = context.request.parameters.filename;
            var restricttoscriptids = context.request.parameters.restricttoscriptids;
            var restricttodomains = context.request.parameters.restricttodomains;
            
            if(restricttoscriptids && restricttodomains){
                form = addPasswordGUID2Fields(form, restricttoscriptids, restricttodomains);
            }
                        
            if(password){
                form.addField({
                    id : 'passwordguidresponse',
                    type : SERVERWIDGETMODULE.FieldType.LONGTEXT,
                    label : 'PasswordGUID Response',
                    displayType: SERVERWIDGETMODULE.FieldDisplayType.INLINE
                }).defaultValue = password;
            }
 
            if(url && passwordGuid && hostKey && filename){
                var sftpConnection = getSFTPConnection(username, passwordGuid, url, hostKey, hostKeyType, port, directory, timeout);
                log.debug('sftpConnection',sftpConnection);
                
                //var filesList = sftpConnection.list({path: '/Inbox',sort: SFTPMODULE.Sort.DATE});
                //log.debug('filesList',filesList);
                
                var downloadedFile = sftpConnection.download({
                    filename: filename
                }).getContents();
                log.debug('File Contents',downloadedFile);
                
                /*var guid = {"guid":"f83e9836e8e8420bbdd8e465404920a7","encoding":"UTF_8"};

    			log.debug('guid', guid);

    			log.debug('data', data);
    			var decipher = crypto.createDecipher({
    				algorithm: crypto.EncryptionAlg.AES,
    				key: guid,//'f83e9836e8e8420bbdd8e465404920a7',
    				iv: 'E12B3B0AB6AD99F38A8445CED333FC82' //'2CDEF9311949CFFE8FB5826275568176'
    			});

    			decipher.update({
    				input: downloadedFile, //hexEncodedString,
    				inputEncoding: encode.Encoding.HEX//
    			});

    			var decipherout = decipher.final({
    				outputEncoding: encode.Encoding.UTF_8
    			});
    			log.debug('decipherout', decipherout.toString()); */
                
                
                form.addField({
                    id : 'filecontents',
                    type : SERVERWIDGETMODULE.FieldType.LONGTEXT,
                    label : 'File Contents',
                    displayType: SERVERWIDGETMODULE.FieldDisplayType.INLINE
                }).defaultValue = downloadedFile.toString();
            } else if (url) {
				var myUrl = HOST_KEY_TOOL_URL + url + "&port=" + port + "&type=" + hostKeyType; 
                var theResponse = HTTPSMODULE.get({url: myUrl}).body;
                form.addField({
                    id : 'hostkeyresponse',
                    type : SERVERWIDGETMODULE.FieldType.LONGTEXT,
                    label : 'Host Key Response',
                    displayType: SERVERWIDGETMODULE.FieldDisplayType.INLINE
                }).defaultValue = theResponse;        
            }
        }
    }
    
  	context.response.writePage(form);
  	return;
}catch(e){
    log.error("Error in execute",e)
}
}
 
function addSelectorFields(form){
    var select = form.addField({
        id: 'selectaction',
        type: SERVERWIDGETMODULE.FieldType.SELECT,
        label: 'Actions list'
    });
    select.addSelectOption({
        value: 'getpasswordguid',
        text: 'Generate Password GUID',
    });  
    select.addSelectOption({
        value: 'gethostkey',
        text: 'Generate Host Key'
    });  
    select.addSelectOption({
        value: 'downloadfile',
        text: 'Test Connectivity'
    });
    return form;
}
 
function addPasswordGUID1Fields(form){
    form.addField({
        id : 'restricttoscriptids',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'Restrict To Script Ids',
    }).isMandatory = true;
    form.addField({
        id : 'restricttodomains',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'Restrict To Domains',
    }).isMandatory = true;
    
    return form;
}
 
function addPasswordGUID2Fields(form, restrictToScriptIds, restrictToDomains){
    form.addCredentialField({
        id : 'password',
        label : '_Password_To_Enter',
        restrictToScriptIds: restrictToScriptIds.replace(' ', '').split(','),
        restrictToDomains: restrictToDomains.replace(' ', '').split(','),
    }).isMandatory = true;
    return form;
}
 
function addHostKeyFields(form){
    form.addField({
        id : 'url',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'URL',
    }).isMandatory = true;
	
    form.addField({
        id : 'port',
        type : SERVERWIDGETMODULE.FieldType.INTEGER,
        label : 'Port',
    });
	
    form.addField({
        id : 'hostkeytype',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'Type',
    });
    return form;
}
 
function addDownloadFileFields(form){
    form.addField({
        id : 'url',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'SFTP URL',
    }).isMandatory = true;
    
    form.addField({
        id : 'username',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'Username',
    }).isMandatory = true;
    form.addField({
        id : 'passwordguid',
        type : SERVERWIDGETMODULE.FieldType.LONGTEXT,
        label : 'Password Guid',
    }).isMandatory = true;
    form.addField({
        id : 'hostkey',
        type : SERVERWIDGETMODULE.FieldType.LONGTEXT,
        label : 'Host Key',
    }).isMandatory = true;
    form.addField({
        id : 'hostkeytype',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'Host Key Type',
    });
    form.addField({
        id : 'filename',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'File Name',
    }).isMandatory = true;
    form.addField({
        id : 'port',
        type : SERVERWIDGETMODULE.FieldType.INTEGER,
        label : 'Port',
    }).isMandatory = true;
    form.addField({
        id : 'directory',
        type : SERVERWIDGETMODULE.FieldType.TEXT,
        label : 'Directory',
    }).isMandatory = true;
    form.addField({
        id : 'timeout',
        type : SERVERWIDGETMODULE.FieldType.INTEGER,
        label : 'Timeout',
    });
    return form;
}
 
function getFormTemplate(){
    var form = SERVERWIDGETMODULE.createForm({
        title : 'SFTP Helper'
    });
    form.addSubmitButton({
        label : 'Submit'
    });
    
    return form;
}
 
function getSFTPConnection(username, passwordGuid, url, hostKey, hostKeyType, port, directory, timeout){
    var preConnectionObj = {};
    preConnectionObj.passwordGuid = passwordGuid;
    preConnectionObj.url = url;
    preConnectionObj.hostKey = hostKey;
    if(username){ preConnectionObj.username = username; }
    if(hostKeyType){ preConnectionObj.hostKeyType = hostKeyType; }
    if(port){ preConnectionObj.port = Number(port); }
    if(directory){ preConnectionObj.directory = directory; }
    if(timeout){ preConnectionObj.timeout = Number(timeout); }
    
    var connectionObj = SFTPMODULE.createConnection(preConnectionObj);
    return connectionObj;
}