/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
var _0x2b0e=['message','Runtime\x20errors\x20during\x20Build\x20COGS\x20Accrual\x20Transactions.\x0a\x0d','getRange','load','success','NONEOF','@NONE@','N/email','Type','COGS\x20Accrual\x20Builder\x20Errors','Statlist','createFilter','N/runtime','tendaysago','Error\x20buildCAT','ONORAFTER','ANYOF','CustInvc','create','datecreated','replace','N/search','Operator','run','debug','\x09~1\x0a\x0d','N/record','Internal\x20id\x20~1\x20error:\x20','custcol_mb_ct_link','error','type','push','INVOICE','length'];(function(_0x50be23,_0xa8a01d){var _0x2b0e24=function(_0x37b760){while(--_0x37b760){_0x50be23['push'](_0x50be23['shift']());}};_0x2b0e24(++_0xa8a01d);}(_0x2b0e,0x193));var _0x37b7=function(_0x50be23,_0xa8a01d){_0x50be23=_0x50be23-0xbf;var _0x2b0e24=_0x2b0e[_0x50be23];return _0x2b0e24;};var _0x5d3720=_0x37b7,EMAIL_FROM_DEFAULT=0x33;define([_0x5d3720(0xcb),_0x5d3720(0xde),_0x5d3720(0xd0),_0x5d3720(0xd9)],function(_0x218091,_0x41f2ee,_0x53c570,_0x570ad7){function _0x580f7b(_0x280a07){try{var _0x5aed01=_0x16a6d0();}catch(_0x161177){throw _0x161177;}}function _0x16a6d0(){var _0x2ce696=_0x37b7,_0x5aae0f=new Array(),_0xa957f9=0x0,_0x3267ae=0x0,_0x1fb35f=0x0,_0x2c3330=_0x410494();if(_0x2c3330)do{var _0x14acdd=_0x2c3330[_0x2ce696(0xc6)]({'start':_0xa957f9,'end':_0xa957f9+0x3e8});for(var _0x16c818 in _0x14acdd){var _0x1e6064=_0x14acdd[_0x16c818]['id'];log[_0x2ce696(0xdc)]('processing\x20record\x20',_0x1e6064);var _0x46dbf0=_0x50bc11(_0x14acdd[_0x16c818]);_0x46dbf0[_0x2ce696(0xc8)]?_0x3267ae++:(_0x1fb35f++,_0x5aae0f[_0x2ce696(0xc1)](_0x46dbf0[_0x2ce696(0xc4)]),log['debug'](_0x2ce696(0xce),JSON['stringify'](_0x46dbf0[_0x2ce696(0xc4)]))),_0xa957f9++;}}while(_0x14acdd[_0x2ce696(0xc3)]>=0x3e8);var _0xf46982={'statList':_0x5aae0f,'goodCount':_0x3267ae,'badCount':_0x1fb35f};return _0xf46982;}function _0x50bc11(_0x26a8e0){var _0x2ac665=_0x37b7,_0x161d64={'success':![]};try{var _0x827ce3=_0x41f2ee[_0x2ac665(0xc7)]({'type':_0x41f2ee['Type'][_0x2ac665(0xc2)],'isDynamic':!![],'id':_0x26a8e0['id']});_0x827ce3['save']();}catch(_0xc0942){log[_0x2ac665(0xbf)](_0x2ac665(0xd2),JSON['stringify'](_0xc0942)),_0x161d64[_0x2ac665(0xc4)]=_0x2ac665(0xdf)['replace']('~1',_0x26a8e0['id'])+_0xc0942[_0x2ac665(0xc4)];}return _0x161d64;}function _0x410494(){var _0x45361e=_0x37b7,_0xd43c1e=new Object();_0xd43c1e[_0x45361e(0xc0)]=_0x570ad7[_0x45361e(0xcc)]['INVOICE'],_0xd43c1e['filters']=[_0x570ad7[_0x45361e(0xcf)]({'name':_0x45361e(0xc0),'operator':_0x570ad7['Operator'][_0x45361e(0xd4)],'values':_0x45361e(0xd5)}),_0x570ad7['createFilter']({'name':_0x45361e(0xd7),'operator':_0x570ad7[_0x45361e(0xda)][_0x45361e(0xd3)],'values':_0x45361e(0xd1)}),_0x570ad7[_0x45361e(0xcf)]({'name':'custcol_mb_ct_createdpo','operator':_0x570ad7[_0x45361e(0xda)][_0x45361e(0xc9)],'values':_0x45361e(0xca)}),_0x570ad7[_0x45361e(0xcf)]({'name':_0x45361e(0xe0),'operator':_0x570ad7['Operator']['ANYOF'],'values':_0x45361e(0xca)})],_0xd43c1e['columns']=[];var _0x38ac17=_0x570ad7[_0x45361e(0xd6)](_0xd43c1e),_0x461a2e=_0x38ac17[_0x45361e(0xdb)]();return _0x461a2e;}function _0x14321c(_0x179475){var _0x342f13=_0x37b7,_0xab35d6='';return _0xab35d6+=_0x342f13(0xc5),_0x179475['forEach'](function(_0x38aaa4){var _0x21ff7d=_0x342f13;_0xab35d6+=_0x21ff7d(0xdd)[_0x21ff7d(0xd8)]('~1',_0x38aaa4),_0xab35d6+='\x0a\x0d';}),_0xab35d6;}function _0xdbc98d(_0x27ad49){var _0x1a2b9a=_0x37b7,_0x2af7a9=EMAIL_FROM_DEFAULT,_0xa46846=_0x1a2b9a(0xcd),_0xdf2b56=_0x27ad49;_0x218091['send']({'author':_0x2af7a9,'recipients':'netsuite@mibar.net','subject':_0xa46846,'body':_0xdf2b56}),log[_0x1a2b9a(0xdc)]('mail\x20sent',_0x2af7a9);}return{'execute':_0x580f7b};});