var aL =  { //логер, работающий через очередь
    list: [],
    add: function(text, isError) {
        if (isError == undefined) isError = false;
        var d = new Date();
        var formated = ("0" + d.getHours()).substr(-2) + ':' + 
                       ("0" + d.getMinutes()).substr(-2) + ':' + 
                       ("0" + d.getSeconds()).substr(-2);
        this.list.push({date: formated, text:text,isError:isError});
        console.log(formated + ' ' + text);
    },
    save: function() {
        var list = this.list;
        this.list = [];
        chrome.storage.local.get('logs',function(data){
            var logs = (typeof data.logs == "undefined" ? [] : data.logs);
            for (var i in list) logs.push(list[i]);
            if (logs.length > 200) logs.splice(0,logs.length - 200); //недопускаем переполнения окна
            chrome.storage.local.set({logs:logs});
        });
    }
};


function trimUselessSpaces(text) {
    return text.replace(/^\s+/,"").replace(/\s+$/,"").replace(/\s+/g," ");
}

function parseTable(text) {
    //text должен быть jQuery-объектом от HTML таблицы. Проверки не делает. Вернет массив данных
    var str = '';
    var trs = text.find('tr:not(:first):not(:has(td[colspan]))');
    var notReady = 0;
    var isApproved = false;
    var lastPerson = '';
    for (var i = trs.length - 1; i >= 0 ; i--) {
        var tr = trs.eq(i);
        var tds = tr.find('td');
        for (var j = 0; j < tds.length; j++) str += trimUselessSpaces(tds.eq(j).text());
        var agreeStatus = trimUselessSpaces(tds.eq(3).text());
        if (agreeStatus == '-' || /Не согласовано/.test(agreeStatus)) {
            var notAgree = /Не согласовано/.test(agreeStatus) ? true : false;
            lastPerson = trimUselessSpaces(tds.eq(1).find('b').text());
            notReady++;
        }
        else if (/Подписано/.test(agreeStatus)) isApproved = true;
    }
    var total = trs.length;
    var md5 = hex_md5(str);
    return {
        md5:        md5,
        ready:      total - notReady,
        total:      total,
        lastPerson: lastPerson,
        notAgree:   notAgree,
        isApproved: isApproved
    };
}