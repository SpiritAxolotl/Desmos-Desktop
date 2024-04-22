const { ipcRenderer } = require('electron');
const remote = require("electron").remote;
const dialog = remote.dialog;
const fs = require('fs');

const StateData = {
    filepath: '',
    last_state: null
}


function showAlert(msg, speed=0.02) {
    const div = `<div class="floating" id="message">${msg}</div>`;
    document.getElementById("container").innerHTML = div;
    const s = document.getElementById('message').style;
    s.opacity = 1;
    function fade() {
        s.opacity -= speed;
        if (s.opacity < 0)
            s.display = "none";
        else
            setTimeout(fade, 40);
    }
    fade();
}


function set_caculator_state(des_file_data) {
    const state = JSON.parse(des_file_data);
    try {
        calculator.setState(state);
    }
    catch(err) {
        calculator.setBlank();
    }
}


function saveText(text, file){
    fs.writeFileSync(file, text);
    showAlert(`Saved successfully. ;)`);
}

function setTitle() {
    if (StateData.filepath)
        document.title = `Desmos - ${StateData.filepath}`;
    else
        document.title = "Desmos - * Untitled";
    ipcRenderer.send('renderer-request', {msg: 'TitleChanged', data: StateData.filepath});
}

setInterval( function(){
    if (isSaved()) return;
    if (StateData.filepath)
        document.title = `Desmos - * ${StateData.filepath}`;
}, 1000);


function newFile() {
    let cancelled = !askSaveIfNeed();
    if (cancelled) return;
    
    calculator.setBlank();
    StateData.filepath = '';
    setTitle();
}


function openFile(filepath=null, init=false) {
    
    if (!init) {
        if (cancelled) return;
        let cancelled = !askSaveIfNeed();
    }
    
    if (!filepath && init) { return; }
    if (!filepath) {
        const filePaths = dialog.showOpenDialog({filters: [ {name: 'des', extensions: ['des'] }]});
        if (!filePaths) return;
        filepath = filePaths[0];
    }
    
    fs.readFile(filepath, (err, data) => {
        if (err) {
            showAlert(`Error on opening :(. ${err.message}`);
            calculator.setBlank();
        }
        //else??
        set_caculator_state(data);
        StateData.filepath = filepath;
        StateData.last_state = data;
        setTitle();
    });
}


function saveFile() {
    if (!StateData.filepath) {
        const file = dialog.showSaveDialog(remote.getCurrentWindow(), {
            filters: [{
                name: "Desmos Files",
                extensions: ['des']
            }]
        });
        if(file) StateData.filepath=file;
    }
    if (StateData.filepath) {
        const state = calculator.getState();
        StateData.last_state = state;
        const state_content = JSON.stringify(state, null, 4);
        saveText(state_content, StateData.filepath);
        setTitle();
    }
}


function saveAsFile() {
    const file = dialog.showSaveDialog(remote.getCurrentWindow(), {
        filters: [
        { name: "Desmos Files", extensions: ['des'] }]
    });
    if (file) StateData.filepath = file;
    if (StateData.filepath) {
        const state = calculator.getState();
        StateData.last_state = state;
        const stateContent = JSON.stringify(state, null, 4);
        saveText(stateContent, StateData.filepath);
        setTitle();
    }
}


function exportImage() {
    let image = calculator.screenshot({
        width: remote.width,
        height: remote.height,
        targetPixelRatio: 2
    });
    
    const imageData = image.replace(/^data:image\/png;base64,/, "");
    
    dialog.showSaveDialog({filters: [ {name: 'png', extensions: ['png'] }]},
        (fileName) => {
        if (fileName === undefined) {
            console.log("You didn't open the file.");
            return;
        }
        // fileName is a string that contains the path and filename created in the save file dialog.
        fs.writeFile(fileName, imageData, 'base64', (err) => {
            if (err)
                alert(`An error ocurred creating the file :(. ${err.message}`);
            else
                showAlert(`Succesfully exported!`);
        });
    }); 
}


function isStateNull() {
    return StateData.last_state === null && calculator.getState().expressions.list[0].latex === undefined;
}


function isSaved() {
    if (isStateNull()) return true;
    if (StateData.filepath === "" || StateData.last_state === null)
        return false;
    else
        return JSON.stringify(calculator.getState().extensions) === JSON.stringify(StateData.last_state.extensions);
}


function askSaveIfNeed(){
    if (isSaved()) return true;
    const response = dialog.showMessageBox(remote.getCurrentWindow(), {
        message: 'Do you want to save the current document?',
        type: 'question',
        buttons: [ 'Yes', 'No', 'Cancel' ]
    });
    // Yes to save
    if (response === 0)
        saveFile();
    
    return response !== 2;
}



function exitApp() {
    const exit = askSaveIfNeed();
    if (exit) {
        showAlert('Exiting...', 0);
        setTimeout(()=>{
            ipcRenderer.sendSync('renderer-response', {msg: 'Exit'});
        }, 600);
    }
}


ipcRenderer.on('mainprocess-request', (event, arg) => {
    console.log(arg);
    switch (arg.msg) {
        case 'NewFile':     newFile();                 break;
        case 'Init':        openFile(arg.data, true);  break;
        case 'OpenFile':    openFile();                break;
        case 'SaveFile':    saveFile();                break;
        case 'SaveAsFile':  saveAsFile();              break;
        case 'ExportImage': exportImage();             break;
        case 'Undo':        calculator.undo();         break;
        case 'Redo':        calculator.redo();         break;
        case 'Clear':       calculator.setBlank();     break;
        case 'Exitting':    exitApp();                 break;
        default:                                       break;
    }
});


document.addEventListener("keydown", event => {
    switch (event.key) {
        case "Escape":
            if (remote.getCurrentWindow().isFullScreen())
                remote.getCurrentWindow().setFullScreen(false);
            else
                remote.getCurrentWindow().close();
            break;
    }
});

ipcRenderer.send('renderer-request', {msg: 'ToInit'})


/*
document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault()
}

document.body.ondrop = (ev) => {
    console.log(ev.dataTransfer.files[0].path)
    ev.preventDefault()
}
*/