const fixed = `
animation_preparation = animation_preparation ~= nil and animation_preparation or {}
local time = obj.getvalue("time")
if animation_preparation[obj.layer] == nil or animation_preparation[obj.layer].time ~= time or animation_preparation[obj.layer][name] then
    animation_preparation[obj.layer] = {}
    animation_preparation[obj.layer].time = time
end
local totaltime,frame,totalframe = 0,0,0
if animation_preparation[obj.layer].thisTime then
    totaltime = animation_preparation[obj.layer].totaltime
    frame = animation_preparation[obj.layer].frame
    totalframe = animation_preparation[obj.layer].totalframe
else
    time = obj.time
    totaltime = obj.totaltime
    frame = obj.frame
    totalframe = obj.totalframe
end
param = param.."obj.time="..time..";obj.totaltime="..totaltime..";obj.frame="..frame..";obj.totalframe="..totalframe..";"
animation_preparation[obj.layer][name] = true
animation_preparation[obj.layer][#animation_preparation[obj.layer]+1] = {"アニメーション効果", "name", name, "track0", obj.track0 or 0, "track1", obj.track1 or 0, "track2", obj.track2 or 0, "track3", obj.track3 or 0, "check0", obj.check0 and 1 or 0, "color", color or 0, "file", file or "", "param", param or ""}
`

const scripts = {}

// --track0,--paramなどの行のみを抽出する
const extractParams = function (body) {
    if (typeof body === 'string') {
        body = body.split(/[\r\n]+/)
    }
    return body.reduce((ret, cur) => {
        if (cur.match(/^--(track[0-3]|check0|param|color|file|dialog)/)) {
            return ret += (cur + '\r\n')
        }
        return ret
    }, '')
}

// 引数のli要素をD&Dで並べ替えできるようにする
const makeSortable = function (elm) {
    elm.ondragstart = function (e) {
        e.dataTransfer.setData('text/plain', e.target.id);
    };
    elm.ondragover = function (e) {
        e.preventDefault();
        let rect = this.getBoundingClientRect();
        if ((e.clientY - rect.top) < (this.clientHeight / 2)) {
            //マウスカーソルの位置が要素の半分より上
            this.style.borderTop = '2px solid blue';
            this.style.borderBottom = '';
        } else {
            //マウスカーソルの位置が要素の半分より下
            this.style.borderTop = '';
            this.style.borderBottom = '2px solid blue';
        }
    };
    elm.ondragleave = function () {
        this.style.borderTop = '';
        this.style.borderBottom = '';
    };
    elm.ondrop = function (e) {
        e.preventDefault();
        let id = e.dataTransfer.getData('text/plain');
        let elm_drag = document.getElementById(id);

        let rect = this.getBoundingClientRect();
        if ((e.clientY - rect.top) < (this.clientHeight / 2)) {
            //マウスカーソルの位置が要素の半分より上
            this.parentNode.insertBefore(elm_drag, this);
        } else {
            //マウスカーソルの位置が要素の半分より下
            this.parentNode.insertBefore(elm_drag, this.nextSibling);
        }
        this.style.borderTop = '';
        this.style.borderBottom = '';
    };
}

// li要素を挿入
const insertLI = function (name) {
    document.getElementById('dammyLI').insertAdjacentHTML('beforebegin',
        `<li id="${name}" draggable="true"><input type="checkbox" id="${name}Chk" checked><label for="${name}Chk">${name}</label></li>`)
    makeSortable(document.getElementById(name))
}

// テキストをSJISでダウンロードさせる
function downloadText(fileName, text) {
    const code = Encoding.stringToCode(text)
    const u8 = new Uint8Array(Encoding.convert(code, 'SJIS'))
    const blob = new Blob([u8], { type: 'text/plain' });
    const aTag = document.createElement('a');
    aTag.href = URL.createObjectURL(blob);
    aTag.target = '_blank';
    aTag.download = fileName;
    aTag.click();
    URL.revokeObjectURL(aTag.href);
}

const fromParam = function(param){
    // --param:x=10;y=20;
    //const array = param.split(/:|=|;/)
    const array = param.match(/(:|;)[^:;=]+=/)
    return array.reduce((ret, val) => {
        const vn = val.replace(/,|=/g, '').trim()
        return ret + vn + '=\"..animation_preparation.tostring(' + vn.replace(/local\s+/, '') + ')..\";'
    }, '\"') + "\""
}

const fromDialog = function(param){
    //--dialog:名前,x=10;名前,y=20;
    //,と=で挟まれた部分が修飾子+変数名
    //文字列値としてそのような部分が含まれていた場合はここでは諦める
    const array = param.match(/,[^,=]+=/g)
    return array.reduce((ret, val) => {
        const vn = val.replace(/,|=/g, '').trim()
        return ret + vn + '=\"..animation_preparation.tostring(' + vn.replace(/local\s+/, '') + ')..\";'
    }, '\"') + "\""
}

// --dialogなどから local param=　… を作る
const createParamString = function (params) {
    let ret = "local param="
    const param = (params.match(/--(param|color|file|dialog).+(\r|\n|\r\n)/))
    if (param) {
        switch (param[1]) {
            case 'color':
                ret += "\"color=\"..color..\";\""
                break;
            case 'file':
                ret += "\"file=\"..file..\";\""
                break;
            case 'param':
                ret += fromParam(param[0])
                break;
            case 'dialog':
                ret += fromDialog(param[0])
                break;
        }
    } else {
        ret += "\"\""
    }
    return ret
}

document.getElementById('file').addEventListener('change', function (e) {
    for (let file of e.target.files) {
        const fileName = file.name
        //アニメーションスクリプトでなければ次へ
        if (!fileName.endsWith('.anm')) {
            continue;
        }
        const reader = new FileReader()
        reader.onload = (e) => {
            //ファイルの中身をjavascript上のstirngへ変換
            const content = Encoding.codeToString(Encoding.convert(new Uint8Array(reader.result), { to: 'UNICODE', from: 'SJIS' }))
            if (fileName.startsWith('@')) {
                content.split(/[\r\n]+@|^@/).forEach(script => {
                    if (script !== '' && script.indexOf('obj.setanchor') == -1) {
                        const lines = script.split(/[\r\n]+/)
                        const name = lines[0] + '@' + fileName.slice(1, fileName.length - 4)
                        const params = extractParams(lines)
                        if (!scripts[name]) {
                            insertLI(name)
                        }
                        scripts[name] = params
                    }
                })
            } else if(content.indexOf('obj.setanchor') == -1) {
                const name = fileName.slice(0, fileName.length - 4)
                const params = extractParams(content)
                if (!scripts[name]) {
                    insertLI(name)
                }
                scripts[name] = params
            }
        }
        reader.readAsArrayBuffer(file)
    }
})

document.getElementById('dl').addEventListener('click', function () {
    let artifact = ''
    Array.prototype.forEach.call(document.getElementById('scriptList').children, li => {
        const name = li.id
        if ((tmp = document.getElementById(name + 'Chk')) && tmp.checked) {
            artifact += '@' + name.replace('@', '_') + '\r\n'
            artifact += scripts[name] + '\r\n'
            artifact += `local name="${name}"` + '\r\n'

            artifact += createParamString(scripts[name])

            artifact += fixed + '\r\n'
        }
    })
    if ( ~navigator.userAgent.indexOf("Windows") ) {
        artifact = artifact.replace(/\n/g, "\r\n").replace(/\r\r/g, "\r")
      }
    downloadText('@準備.anm', artifact)
})