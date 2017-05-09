chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.action && (request.action == "getDOM")) {
            sendResponse(document.documentElement.outerHTML);
        }
    }
);

chrome.storage.local.get(['DNSID','domain'],function(data) { //если DNSID не установлен, пробуем вырвать из текущей страницы
    if (data.DNSID == null || data.domain == null) trySetDNSID();
});
//если только что авторизировались, сохраним свежий DNSID и активный домен
if (/\.ru\/login\.php/.test(document.referrer)) trySetDNSID();

function trySetDNSID() { //эта функция за одно еще и запоминает DNSID
    var DNSID = /DNSID=([^&]+)/.exec(window.location.href);
    if (DNSID && DNSID[1] != null) chrome.storage.local.set({DNSID:DNSID[1]});

    var domain = /https:\/\/([^\/]+)\//.exec(window.location.href);
    if (domain && domain[1] != null) chrome.storage.local.set({domain:domain[1]});
}


var UrgentRemoveCheckCounter = 0;//Отключение сообщения о срочном документе
var intervalForUrgentRemove = null;
chrome.storage.local.get('closeUrgentPopup',function(data) {
    var closeUrgentPopup = data.closeUrgentPopup;
    if (closeUrgentPopup == true) {
        intervalForUrgentRemove = setInterval(function() {
            var div = document.getElementById('urgent_popup');
            if (div !== null) {
                div.querySelectorAll('.close')[0].click();
                clearInterval(intervalForUrgentRemove);
                return;
            }
            if (UrgentRemoveCheckCounter++ > 300) {
                clearInterval(intervalForUrgentRemove);
            }
        },10);
    }
})