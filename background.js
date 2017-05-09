chrome.alarms.clear();
for (i = 0; i < 60; i++) chrome.alarms.create('mainAndTheOnlyUsedAlarm_id'+i,{when:Date.now() + i*1000,periodInMinutes: 1});

//chrome.alarms.create('debug',{when:Date.now() + 1 * 1000});
chrome.storage.local.get('inWork', function(data){
    var inWork = data.inWork;
    if (inWork !== true) inWork = false;
    chrome.storage.local.set({inWork:inWork});
});

var icons = ['icon.png','icon_err.png','icon_got.png'];

chrome.alarms.onAlarm.addListener(function(alarm) {
    chrome.storage.local.get(null, function(data){
        //работа с иконками
        var hasError = false;
        for (var i in data.logs) {
            if (data.logs[i].isError) {
                hasError = true;
                break;
            }
        }
        var hasUpdate = false;
        for (i in data.urls) {
            if (data.urls[i].isUpdated) {
                var hasUpdate = true;
                break;
            }
        }
        var sec = (new Date()).getSeconds() % 2; //в четные/нечетные секунды меняем иконку, она мерцает. Прикольно. Ы
        if      (sec == 0 && hasError)  chrome.browserAction.setIcon({path: '/misc/'+icons[1]});
        else if (sec == 1 && hasUpdate) chrome.browserAction.setIcon({path: '/misc/'+icons[2]});
        else                            chrome.browserAction.setIcon({path: '/misc/'+icons[0]});
        
        //парсинг
        try {
            var minuteNow = (new Date).getMinutes();
            if (!data.runNow) {
                if (data.inWork != true) {
                    console.log('return cuz inWork=false');
                    return;
                }
                if (minuteNow != 30 && minuteNow != 0) {
                    console.log('return cuz minuteNow reason');
                    return;
                }
                if (data.lastRun == minuteNow) {
                    console.log('return cuz lastRun == minuteNow');
                    return;
                }
                else chrome.storage.local.set({lastRun:minuteNow});
            }
            else chrome.storage.local.set({runNow:false});
            var ajaxes = [];
            for (var id in data.urls) {
                if (data.urls[id].isUpdated) continue;
                var link = "https://"+data.domain+"/document.card.php?id="+id+"&DNSID="+data.DNSID;
                aL.add(id + ' парсинг');
                var ajax = $.ajax({
                    url : link,
                    async: false,
                    url_id : id, //это нужно, чтобы передать id в контекст обработчика success
                    success : function(result){
                        try {
                            var id = this.url_id;
                            if (/<b>Доступ запрещен<\/b>/.test(result)) {
                                aL.add(id + ' Кажется, не включен VPN',true);
                                return;
                            }
                            else if (/var availableOrganizations/.test(result)) {
                                aL.add(id + ' Кажется, нет авторизации. Попробуйте перелогиниться', true);
                                chrome.storage.local.remove('DNSID');
                                return;
                            }
                            else if (/<table.+?class=".*?agreetable.*?".*?>[\w\W]+?<\/table>/.test(result) == false) {
                                aL.add(id + ' Таблица согласования по целевой ссылке не обнаружена', true);
                                return;
                            }
                            result = $(/<table.+?class=".*?agreetable.*?".*?>[\w\W]+?<\/table>/.exec(result)[0]);
                            var obj = parseTable(result);

                            if (data.urls[id].md5 != obj.md5) {
                                obj.isUpdated = true;
                                obj.time = (new Date).getTime();
                                for (var q in obj) data.urls[id][q] = obj[q];
                            }
                        } catch (e) {
                            aL.add('Исключение2: ' + e.name + ' '+e.message+' '+e.stack, true);
                            aL.save();
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        aL.add(this.url_id + ' ошибка в $.ajax: ' + textStatus + ' ' + errorThrown, true);
                        if (errorThrown == 'Forbidden') aL.add(this.url_id + ' Кажется, не включен VPN',true);
                    }
                });
                ajaxes.push(ajax);
            }
            if (ajaxes.length != 0) $.when.apply($, ajaxes).then(function() {//если done
                aL.add('Сессия парсинга завершена');
                chrome.storage.local.set({urls:data.urls});
                aL.save();
            },function(){ //если fail
                aL.add('Сессия парсинга неудачна',true);
                aL.save();
            });
            
        } catch (e) {
            aL.add('Исключение1: ' + e.name + ' '+e.message+' '+e.stack, true);
            aL.save();
        }
    });
});

function applyChanges(doThis) { //почему не sendMessage? Потому что мессаджи не посылаются из popup при работе из unload. Я не нашел, почему
    chrome.storage.local.get('urls',function(data){
        var urls = data.urls;
        for (var i in doThis.changeStatus) urls[doThis.changeStatus[i]].isUpdated = !urls[doThis.changeStatus[i]].isUpdated;
        for (var i in doThis.deleteIt) delete urls[doThis.deleteIt[i]];
        chrome.storage.local.set({urls:urls});
    });
}