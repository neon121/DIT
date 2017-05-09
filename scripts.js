var frequence_default = 1800;
var frequence_min = 1800;
var frequence_max = 3600;

var objForRunNowInterval = {time:-1,interval:null};
var intervalForLogs = null;
$(function() {
    setWorkCheckbox();
    setWatchCheckbox();
    setErrorSpan();
    setAddonCheckbox();
    $( "#tabs" ).tabs({
        activate:function(event, ui) {
            setLogs();
            if (ui.newPanel.attr('id') == 'tab_log') {
                intervalForLogs = setInterval(function(){setLogs()},1000);
            }
            else clearInterval(intervalForLogs);
        }
    });
    $(document).tooltip({
        position: { my: "center center+40", at: "top left" },
        show: { delay: 800, effect: "clip", duration: 100 },
        open: function (event, ui) {setTimeout(function () {
                $(ui.tooltip).hide({ effect: "clip", duration: 100 });
        }, 3000)}
    });
    
    $( "#watchThis" ).checkboxradio().change(function() {
        $(this).checkboxradio({label:$(this).prop('checked') ? "Снять наблюдение" : "Наблюдать за этим"});
        chrome.storage.local.get(['urls','DNSID','domain'],function(data){
            chrome.tabs.query({active:true, currentWindow:true}, function(tab){
                var id = /id=([\d]+)/.exec(tab[0].url)[1];
                var urls = data.urls;
                if ($("#watchThis").prop('checked')) {
                    if ($('#tab_list .list tr[data-id='+id+']').length != 0) {
                        $('.list [data-id='+id+']').removeClass('deleteIt');
                        return;
                    }
                    if (typeof urls != 'object') urls = {}; 
                    var name = '';
                    chrome.tabs.sendMessage(tab[0].id, {action: "getDOM"}, function(response) {
                        var totalJq = $(response);
                        name = totalJq.find('.s-agree-comment__table tr:eq(0) td:eq(1)').text();
                        table = $(/<table.+?class=".*?agreetable.*?".*?>[\w\W]+?<\/table>/.exec(response)[0]);
                        var obj = parseTable(table);
                        obj.name = name;
                        obj.time = (new Date).getTime();
                        urls[id] = obj;
                        insertTR(id,obj,data.DNSID,data.domain);
                        chrome.storage.local.set({urls:urls});
                    });
                }
                else {
                    $("#watchThis").checkboxradio({label:"Наблюдать за этим"});
                    $('.list [data-id='+id+']').addClass('deleteIt');
                }
                chrome.storage.local.set({urls:urls});
            });
        });
    }); 
    
    $( "#inWork" ).checkboxradio().change(function() {
        var inWork = $(this).prop('checked');
        chrome.storage.local.set({inWork:inWork});
        toggleInWorkStatus(inWork);
    });
    
    $('#runNow').button().click(function(){
        $(this).button({label:"Разблокировка через 3с...", disabled:true});
        objForRunNowInterval.interval = setInterval(function() {
            if (objForRunNowInterval.time == -1) objForRunNowInterval.time = 2;
            if (objForRunNowInterval.time > 0) {
                $('#runNow').button({
                    label:'Разблокировка через '+objForRunNowInterval.time+'с...',
                    disabled:true
                });
            }
            else {
                $('#runNow').button({
                    label:'Запустить сейчас',
                    disabled:false
                });
                clearInterval(objForRunNowInterval.interval);
            };
            objForRunNowInterval.time--;
        },1000);
        chrome.storage.local.set({runNow:true});
    });

    $('#frequence input').change(function(){
        var frequence = parseInt($(this).val());
        if (isNaN(frequence)) frequence = frequence_default;
        if (frequence < frequence_min) frequence = frequence_min;
        if (frequence > frequence_max) frequence = frequence_max;
        $(this).val(frequence);
        chrome.storage.local.set({frequence:$(this).val()});
    });
    
    chrome.storage.local.get(['urls','logs','DNSID','domain'],function(data) {
        var DNSID = data.DNSID;
        var urls = data.urls;
        var domain = data.domain;
        if (urls != undefined) {
            for (var id in urls) insertTR(id, urls[id],DNSID,domain);
            var all_count = $('#tab_list .list tr').length;
            var nws_count = $('#tab_list .list tr.isUpdated').length;
            $('#inWatch').text(all_count);
            if (nws_count > 0) {
                $('#newStatus').text(nws_count);
                $('#hasChanged').css('display','inline');
            }
            else {
                $('#hasChanged').css('display','none');
            }
        }
    });
    
    $('.edit').click(function() {
        var a = $(this).parents('tr').find('.name a');
        a.attr('data-prevValue',a.text());
        a.attr('contenteditable',true).tooltip({disabled:true}).focus().tooltip({disabled:false});
        $('.edit').css("pointer-events", "none");
    }); 
    
    $('.name a').on('focusout keypress',function(event) {
        if (event.type == 'keypress' && event.charCode != 13) return true; //если нажат НЕ enter
        var id = $(this).parents('tr').attr('data-id');
        var text = $(this).text();
        if (text.length == 0) {
            $(this).text($(this).attr('data-prevValue'));
            $(this).removeAttr('data-prevValue');
            return false;
        }
        $('#tab_main .list tr[data-id='+id+'] .name a, #tab_main .list tr[data-id='+id+'] .name a').text(text);
        chrome.storage.local.get('urls',function(data){
            var urls = data.urls;
            urls[id].name = text;
            chrome.storage.local.set({urls:urls});
        });
        $(this).removeAttr('contenteditable');
        $('.edit').css("pointer-events", "auto");
        if (event.type == 'keypress') return false;
    });
    
    $('.changeStatus').click(function() {
        var tr = $('#tab_list .list [data-id=' + $(this).parents('tr').attr('data-id') + ']');
        var trInMain = $('#tab_main .list [data-id=' + $(this).parents('tr').attr('data-id') + ']');
        if (tr.hasClass('notUpdated')) {
            tr.addClass('isUpdated').removeClass('notUpdated');
            if (trInMain.length == 0) tr.clone(true).appendTo($('#tab_main .list'));
            else trInMain.addClass('isUpdated').removeClass('notUpdated');
        }
        else {
            tr.addClass('notUpdated').removeClass('isUpdated');
            trInMain.addClass('notUpdated').removeClass('isUpdated');
        }
        tr.toggleClass('changedStatus');
    });
    
    $('.remove').click(function() {
        var id = $(this).parents('tr').attr('data-id');
        $('.list [data-id=' + id + ']').toggleClass('deleteIt');
        chrome.tabs.query({active:true, currentWindow:true}, function(tab){
            var idOfShowen = /id=([\d]+)/.exec(tab[0].url)[1];
            if (id == idOfShowen) toggleWatchStatus('can');
        });
    });
    
    $('#clearLog').button({}).click(function(){
        chrome.storage.local.set({'logs':[]});
        $('#isError').removeClass('true');
        $('#tab_log table tr:not(.etalon)').remove();
    });
    
    $("#closeUrgentPopup").checkboxradio().change(function() {
        chrome.storage.local.set({closeUrgentPopup:$(this).prop('checked')});
    });
});

window.addEventListener("unload", function(e) {
    var doThis = {deleteIt: [],changeStatus:[]};

    var deleted = $('#tab_list tr.deleteIt');
    for (var i = 0; i < deleted.length; i++) doThis.deleteIt.push(deleted.eq(i).attr('data-id'));

    var changed = $('#tab_list tr.changedStatus:not(.deleteIt)');
    for (var i = 0; i < changed.length; i++) doThis.changeStatus.push(changed.eq(i).attr('data-id'));

    chrome.extension.getBackgroundPage().applyChanges(doThis);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == "complete") setWatchCheckbox();
});

function setWorkCheckbox() {
    chrome.storage.local.get('inWork',function(data) {
        var inWork = data.inWork;
        if (inWork !== true) chrome.storage.local.set({inWork:false});
        toggleInWorkStatus(inWork);
    });
}

function toggleInWorkStatus(inWork) {
    if (inWork) $('#inWork').checkboxradio({label:"В работе..."}).prop('checked',true).checkboxradio('refresh');
    else        $('#inWork').checkboxradio({label:"Отдыхаю"}).prop('checked',false).checkboxradio('refresh');
}

function setWatchCheckbox() {
    chrome.tabs.query(                                     
            {active:true, currentWindow:true},
            function(tab){
                if (/\.ru\/document\.card\.php/.test(tab[0].url)) {
                    chrome.storage.local.get('urls',function(data){
                        var url = tab[0].url;
                        var tabId = tab[0].id;
                        var urls = data.urls;
                        var id = /id=([^&]+)/.exec(url);
                        if (id != null && id[1] != null && typeof urls == 'object' && typeof urls[id[1]] != 'undefined') 
                            toggleWatchStatus('alreadyIn');
                        else chrome.tabs.sendMessage(tabId, {action: "getDOM"}, function(response) {
                            var jq = $(response);
                            var hasH1 = (jq.find('h1').eq(0).text() == 
                                    'Согласование документов: Карточка регистрации документа');
                            var hasDiv = (jq.find('div.title div:eq(1)').text() == 'Лист согласования');
                            var hasTbl = (jq.find('.agreetable').length == 1);
                            
                            if (hasH1 && hasDiv && hasTbl) toggleWatchStatus('can');
                            else toggleWatchStatus('cant');
                        });
                    });
                }
                else toggleWatchStatus('cant');
            }
    );
}

function setAddonCheckbox() {
    chrome.storage.local.get('closeUrgentPopup', function(data){
        var closeUrgentPopup = data.closeUrgentPopup;
        if (closeUrgentPopup === undefined) {
            closeUrgentPopup = true;
            chrome.storage.local.set({closeUrgentPopup:true});
        }
        $('#closeUrgentPopup').prop('checked',closeUrgentPopup).checkboxradio('refresh');
    })
}

function toggleWatchStatus(status) {
    switch (status) {
        case 'can':
            $("#watchThis")
                    .checkboxradio({disabled:false, label:"Наблюдать за этим"})
                    .prop("checked", false).checkboxradio('refresh');
            break;
        case 'cant':
            $("#watchThis").checkboxradio({disabled:true, label:"Не вижу лист согласования"})
                    .prop("checked", false).checkboxradio('refresh');
            break;
        case 'alreadyIn':
            $("#watchThis").checkboxradio({disabled:false, label:"Снять наблюдение"})
                    .prop("checked", true).checkboxradio('refresh');
            break;
    }
}

function setErrorSpan() {
    chrome.storage.local.get('logs', function(data) {
        var logs = data.logs;
        for (var i in logs) if (logs[i].isError) {
            $('#isError').addClass('true');
            return;
        }
        $('#isError').removeClass('true');
    });
}

function formatDateForPopup(d) {
    //форматирует дату в формете dM<br/>H:i, где M - месяц в виде 3х букв. d - таймштамп
    d = new Date(d);
    var text = '';
    text = ("0" + d.getDate()).substr(-2);
    switch (d.getMonth()) {
        case 0: text += 'янв'; break; 
        case 1: text += 'фев'; break;
        case 2: text += 'мар'; break;
        case 3: text += 'апр'; break;
        case 4: text += 'май'; break;
        case 5: text += 'июн'; break;
        case 6: text += 'июл'; break;
        case 7: text += 'авг'; break;
        case 8: text += 'сен'; break;
        case 9: text += 'окт'; break;
        case 10: text += 'ноя'; break;
        case 11: text += 'дек'; break;
    }
    text += "<br/>";
    text += ("0" + d.getHours()).substr(-2) + ':' + 
                   ("0" + d.getMinutes()).substr(-2);
    return text;
}

function insertTR(id, obj, DNSID, domain) {
    //вставляет TR в общую и, если надо, в таблицу обновлений. obj - объект с данными
    var etalon = $('#tab_main .list').find('.etalon');
    var tr = etalon.clone(true).attr('data-id',id).removeClass('etalon');
    tr.find('.name a').text(obj.name).attr('href','https://'+domain+'/document.card.php?id='+id+'&DNSID='+DNSID);
    var mailto = 'mailto:'+encodeURI(obj.lastPerson)+'?body='+encodeURI("https://"+domain+"/document.card.php?id="+id);
    tr.find('.lastPerson a').text(obj.lastPerson).attr('href',mailto);
    tr.find('.total').text(obj.total);
    tr.find('.ready').text(obj.ready);
    tr.find('.time').html(formatDateForPopup(obj.time));
    if (obj.notAgree) tr.addClass('notAgree');
    if (obj.isUpdated) tr.addClass('isUpdated');
    else tr.addClass('notUpdated');
    if (obj.isApproved) tr.addClass('isApproved');
    tr.appendTo($('#tab_list .list'));
    if (obj.isUpdated) tr.clone(true).appendTo($('#tab_main .list'));
}

function setLogs() {
    chrome.storage.local.get('logs',function(data){
        $('#tab_log tr:not(.etalon)').remove();
        var logs = data.logs;
        if (logs != undefined) {
            var etalon = $('#tab_log .etalon');
            for (var i = logs.length - 1; i >= 0; i--) {
                var log = logs[i];
                var tr = etalon.clone(true).removeClass('etalon');
                tr.find('td').eq(0).text(log.date);
                tr.find('td').eq(1).find('pre').text(log.text);
                if (log.isError) tr.addClass('error');
                tr.appendTo('#tab_log table');
            }
        }
    });
}