// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const wrapper = document.getElementById('AIPlayerWrapper');
const authServer = 'https://account.aistudios.com';
const AI_PLAYER = new AIPlayer(wrapper);
const initAiName = 'Paris_Yellow';
// Replace with your own DeepBrain AI Studios model ID (see README prerequisites)
const AI_Id = "__ai_model_id__";

// Replace the placeholders below with your own DeepBrain AI Studios credentials.
// See the "Prerequisites" section in the README. Do not commit real values.
let appId   ='__appid__';
let userKey ='__userkey__';


AI_PLAYER.setConfig({
  authServer: authServer,
  midServer: 'https://aimid.deepbrain.io',
  // resourceServer: 'https://resource.deepbrainai.io',
  // backendServer: 'https://backend.deepbrainai.io',
});

const DATA = { appId: '', clientToken: '', verifiedToken: '', tokenExpire: 0, maxTextLength: 70 };
console.log(DATA);

initSample();




async function initSample() {
  const querystring = window.location.search;
  const params = new URLSearchParams(querystring);

  closePop();
  initAIPlayerEvent();
  initUI();
  await generateClientToken();
  await generateVerifiedToken();

  /*if (!DATA.appId || !DATA.verifiedToken) return;
  if (params.get('id')) {
    await getModelInfo(params.get('id'));
  } else {
    await getAIList();
  }
*/
  if (!DATA.appId || !DATA.verifiedToken) return;
  if (AI_Id) {
    await getModelInfo(params.get(AI_Id));
  } else {
    await getAIList();
  }
}
 

// =========================== Model Test ================================ //
async function getModelInfo(id) {
  const result = await makeRequest('GET', `${authServer}/api/aihuman/v2/getModelInfo?id=${AI_Id}`);
  makeAIList(result.ai);
}

// =========================== AIPlayer Setup ================================ //

/* 
  generateClientToken! 
  => Put your own backend api or function that can return jwt
  You can check how to make jwt in AIHuman Web SDK Manual
 */
async function generateClientToken() {
  const result = await makeRequest(
    'GET',
    `${authServer}/api/aihuman/generateClientToken?appId=${appId}&userKey=${userKey}`,
  );

  if (result?.succeed) {
    DATA.clientToken = result.token;
    DATA.appId = result.appId;
  } else showPop('Error', result?.error);
}

async function generateVerifiedToken() {
  if (!DATA.appId || !DATA.clientToken) return;

  const result = await AI_PLAYER.generateToken({ appId: DATA.appId, token: DATA.clientToken });
  if (result?.succeed) {
    DATA.verifiedToken = result.token;
    DATA.tokenExpire = result.tokenExpire;
  } else {
    console.log('generateVerifiedToken Error:', result);
    showPop('generateVerifiedToken Error', result.error);
    DATA.verifiedToken = '';
  }
}

// if token is expired, get refresh clientToken, verifiedToken
async function refreshTokenIFExpired() {
  const afterExpired = moment().unix() + 60 * 60; // compare expire after 1 hour
  if (!DATA.tokenExpire || DATA.tokenExpire <= afterExpired) {
    await generateVerifiedToken();

    if (!DATA.verifiedToken) {
      // if clientToken is expired, get clientToken again
      await generateClientToken();
      await generateVerifiedToken();
    }
  }
}

async function getAIList() {
  if (!DATA.appId || !DATA.verifiedToken) return;
  await refreshTokenIFExpired();

  const result = await AI_PLAYER.getAIList();
  if (result?.succeed) {
    // create ai select options
    if (result.ai.length === 0) $('#AIPlayerStateText').text('There is no AI model available.');
    else await makeAIList(result.ai);
  } else {
    console.log('getAIList Error:', result);
    showPop('getAIList Error', result.error);
  }
}

async function startAI(aiName, aiType) {
  if (!DATA.appId || !DATA.verifiedToken) return;
  await refreshTokenIFExpired();
  initUI(aiType);
  //oldaiName: 'fast-paris2_light',
  await AI_PLAYER.init({
     aiName: 'fast-paris2_light',
    size: 1.0,
    left: 0,
    top: 40,
    speed: 1.0,
  });
  //makeTextList(await AI_PLAYER.getSampleTextList());
  //makeGestureList(AI_PLAYER.getGestures());

  const gender = AI_PLAYER.getGender();
  makeCustomVoiceLanguageList(AI_PLAYER.getSpeakableLanguages(gender));
  makeCustomVoiceList(AI_PLAYER.getCustomVoicesWith(null, gender), true);

  DATA.maxTextLength = AI_PLAYER.getter('maxTextLength');
}

// =========================== AIPlayer Callback ================================ //

function initAIPlayerEvent() {
  AI_PLAYER.onAIPlayerError = function (err) {
    // let str = `[${err.errorCode}] ${err.error}`;
    // const desc = err.detail || err.description;
    // $('#AIPlayerStateText').text('AIPlayer Error');
    // if (desc) str += `<br>${desc}`;
    // showPop('AIPlayer Error', str);
  };

  AI_PLAYER.onAIPlayerStateChanged = async function (state, detail = '') {
    // switch (state) {
    //   case 'playerLoadStarted':
    //     $('#AIPlayerStateText').text('AI Resource loading started.');
    //     $('#aiList').attr('disabled', 'disabled');
    //     break;
    //   case 'playerLoadComplete':
    //     $('#aiList').removeAttr('disabled');
    //     $('#AIPlayerStateText').text('AI Resource loading completed.');
    //     break;
    //   case 'speakingPrepareStarted':
    //     $('#AIPlayerStateText').text('AI started preparation to speak.');
    //     break;
    //   case 'speakingPrepareComplete':
    //     $('#AIPlayerStateText').text('AI finished preparation to speak.');
    //     break;
    //   case 'speakingStarted':
    //     $('#AIPlayerStateText').text('AI started speaking.');
    //     break;
    //   case 'speakingComplete':
    //     $('#AIPlayerStateText').text('AI finished speaking.');
    //     break;
    //   case 'preloadStarted':
    //     $('#AIPlayerStateText').text('AI started preparation to preload.');
    //     break;
    //   case 'preloadComplete':
    //     $('#AIPlayerStateText').text('AI finished preparation to preload.');
    //     break;
    // }
    // console.log('onAIPlayerStateChanged:' + state)
  };

  //AIEvent & callback
  const AIEventType = Object.freeze({
    RES_LOAD_STARTED: 0,
    RES_LOAD_COMPLETED: 1,
    AICLIPSET_PLAY_PREPARE_STARTED: 2,
    AICLIPSET_PLAY_PREPARE_COMPLETED: 3,
    AICLIPSET_PRELOAD_STARTED: 4,
    AICLIPSET_PRELOAD_COMPLETED: 5,
    AICLIPSET_PRELOAD_FAILED: 6,
    AICLIPSET_PLAY_STARTED: 7,
    AICLIPSET_PLAY_COMPLETED: 8,
    AICLIPSET_PLAY_FAILED: 9,
    AI_CONNECTED: 10,
    AI_DISCONNECTED: 11,
    AICLIPSET_PLAY_BUFFERING: 12,
    AICLIPSET_RESTART_FROM_BUFFERING: 13,
    AIPLAYER_STATE_CHANGED: 14,
    UNKNOWN: -1,
  });

  AI_PLAYER.onAIPlayerEvent = function (aiEvent) {
    let typeName = '';
    switch (aiEvent.type) {
      case AIEventType.AIPLAYER_STATE_CHANGED:
        typeName = 'AIPLAYER_STATE_CHANGED';
        break;
      case AIEventType.AI_CONNECTED:
        typeName = 'AI_CONNECTED';
        $('#AIPlayerStateText').text('AI Connected.');
        break;
      case AIEventType.RES_LOAD_STARTED:
        typeName = 'RES_LOAD_STARTED';
        $('#AIPlayerStateText').text('AI Resource loading started.');
        $('#aiList').attr('disabled', 'disabled');
        break;
      case AIEventType.RES_LOAD_COMPLETED:
        typeName = 'RES_LOAD_COMPLETED';
        $('#aiList').removeAttr('disabled');
        $('#AIPlayerStateText').text('AI Resource loading completed.');
        break;
      case AIEventType.AICLIPSET_PLAY_PREPARE_STARTED:
        typeName = 'AICLIPSET_PLAY_PREPARE_STARTED';
        $('#AIPlayerStateText').text('AI started preparation to speak.');
        break;
      case AIEventType.AICLIPSET_PLAY_PREPARE_COMPLETED:
        typeName = 'AICLIPSET_PLAY_PREPARE_COMPLETED';
        $('#AIPlayerStateText').text('AI finished preparation to speak.');
        break;
      case AIEventType.AICLIPSET_PRELOAD_STARTED:
        typeName = 'AICLIPSET_PRELOAD_STARTED';
        $('#AIPlayerStateText').text('AI started preparation to preload.');
        break;
      case AIEventType.AICLIPSET_PRELOAD_COMPLETED:
        typeName = 'AICLIPSET_PRELOAD_COMPLETED';
        $('#AIPlayerStateText').text('AI finished preparation to preload.');
        break;
      case AIEventType.AICLIPSET_PLAY_STARTED:
        typeName = 'AICLIPSET_PLAY_STARTED';
        $('#AIPlayerStateText').text('AI started speaking.');
        break;
      case AIEventType.AICLIPSET_PLAY_COMPLETED:
        typeName = 'AICLIPSET_PLAY_COMPLETED';
        $('#AIPlayerStateText').text('AI finished speaking.');
        break;
      case AIEventType.AI_DISCONNECTED:
        typeName = 'AI_DISCONNECTED';
        $('#AIPlayerStateText').text('AI Disconnected. Please wait or reconnect');
        break;
      case AIEventType.AICLIPSET_PRELOAD_FAILED:
        typeName = 'AICLIPSET_PRELOAD_FAILED';
        $('#AIPlayerStateText').text('AI preload failed.');
        break;
      case AIEventType.AICLIPSET_PLAY_FAILED:
        typeName = 'AICLIPSET_PLAY_FAILED';
        $('#AIPlayerStateText').text('AI play failed.');
        break;
      case AIEventType.AICLIPSET_PLAY_FAILED:
        typeName = 'AICLIPSET_PLAY_FAILED';
        $('#AIPlayerStateText').text('AI play failed.');
        break;
      case AIEventType.AICLIPSET_PLAY_BUFFERING:
        typeName = 'AICLIPSET_PLAY_BUFFERING';
        $('#AIPlayerStateText').text('AI is buffering.');
        break;
      case AIEventType.AICLIPSET_RESTART_FROM_BUFFERING:
        typeName = 'AICLIPSET_RESTART_FROM_BUFFERING';
        $('#AIPlayerStateText').text('AI is restarted from buffering.');
        break;
      case AIEventType.UNKNOWN:
        typeName = 'UNKNOWN';
        break;
    }

    console.log('onAIPlayerEvent:', aiEvent.type, typeName, 'clipSet:', aiEvent.clipSet);
  };

  AI_PLAYER.onAIPlayerLoadingProgressed = function (result) {
    $('#AIPlayerStateText').text(`AI Resource Loading... ${result.loading || 0}%`);
  };

  //AIError & callback
  const AIErrorCode = Object.freeze({
    AI_API_ERR: 10000,
    AI_SERVER_ERR: 11000,
    AI_RES_ERR: 12000,
    AI_INIT_ERR: 13000,
    INVALID_AICLIPSET_ERR: 14000,
    AICLIPSET_PRELOAD_ERR: 15000,
    AICLIPSET_PLAY_ERR: 16000,
    RESERVED_ERR: 17000,
    UNKNOWN_ERR: -1,
  });

  AI_PLAYER.onAIPlayerErrorV2 = function (aiError) {
    let codeName = 'UNKNOWN_ERR';
    if (aiError.code >= AIErrorCode.RESERVED_ERR) {
      codeName = 'RESERVED_ERR';
    } else if (aiError.code >= AIErrorCode.AICLIPSET_PLAY_ERR) {
      codeName = 'AICLIPSET_PLAY_ERR';
    } else if (aiError.code >= AIErrorCode.AICLIPSET_PRELOAD_ERR) {
      codeName = 'AICLIPSET_PRELOAD_ERR';
    } else if (aiError.code >= AIErrorCode.INVALID_AICLIPSET_ERR) {
      codeName = 'INVALID_AICLIPSET_ERR';
    } else if (aiError.code >= AIErrorCode.AI_INIT_ERR) {
      codeName = 'AI_INIT_ERR';
    } else if (aiError.code >= AIErrorCode.AI_RES_ERR) {
      codeName = 'AI_RES_ERR';
    } else if (aiError.code >= AIErrorCode.AI_SERVER_ERR) {
      codeName = 'AI_SERVER_ERR';
    } else if (aiError.code >= AIErrorCode.AI_API_ERR) {
      codeName = 'AI_API_ERR';
    } else if (aiError.code > AIErrorCode.UNKNOWN_ERR) {
      //0 ~ 9999
      codeName = 'BACKEND_ERR';

      if (aiError.code == 1402) {
        //invalid or token expired
        refreshTokenIFExpired();
      }
    }

    //let str = `[${err.errorCode}] ${err.error}`;
    let str = `[${aiError.code}] ${codeName}`;
    //const desc = err.detail || err.description;
    const desc = aiError.message;

    $('#AIPlayerStateText').text('AIPlayer Error');

    if (desc) str += `<br>${desc}`;
    showPop('AIPlayer Error', str);

    console.log('onAIPlayerErrorV2', aiError.code, codeName, aiError.message);
  };
}

// =========================== AIPlayer Function ================================ //


function sendText() {
  const text = $('#sampleText').val();
  const gst = $('#gestureSelect').val();

  speak({ text, gst });
}

async function speak(clipSet) {
  await refreshTokenIFExpired();

  AI_PLAYER.send(clipSet);
}

async function preload(clipSet) {
  await refreshTokenIFExpired();

  AI_PLAYER.preload(clipSet);
}

function pause() {
  $('#AIPlayerStateText').text('Speech paused');
  AI_PLAYER.pause();
}

function resume() {
  $('#AIPlayerStateText').text('Speech resumed');
  AI_PLAYER.resume();
}

function stop() {
  $('#AIPlayerStateText').text('Speech Stoped');
  AI_PLAYER.stopSpeak();
}

function sendPreload() {
  const text = $('#sampleText').val();
  const gst = $('#gestureSelect').val();

  preload({ text, gst }).then();

  $('#AIPlayerStateText').text('AI started preparation to preload.');
}

function onChangeScale() {
  const scale = $('#scaleControl').val();
  AI_PLAYER.setter({ size: parseFloat(scale) });

  console.log('onChangeScale', scale);
}

function onChangeSpeed() {
  const speed = $('#speedControl').val();
  AI_PLAYER.setter({ speed: parseFloat(speed) });

  console.log('onChangeSpeed', speed);
}

function kwonChangeXposition(xpo) {
  const xposition = $('#xControl').val();
  AI_PLAYER.setter({ left: xpo });
}

function kwonChangeYposition(ypo) {
  const yposition = $('#yControl').val();
  AI_PLAYER.setter({ top: ypo });
}



function onChangeXposition() {
  const xposition = $('#xControl').val();
  AI_PLAYER.setter({ left: parseInt(xposition) });
}

function onChangeYposition() {
  const yposition = $('#yControl').val();
  AI_PLAYER.setter({ top: parseInt(yposition) });
}

// =========================== UI ================================ //

async function selectModel() {
  const selected = $('#aiList option:selected');
  const value = selected.val();
  const type = selected.attr('type');
  await startAI(value, type);
}

async function selectCustomVoiceLanguage() {
  const value = $('#customVoiceLanguageList option:selected').val();

  makeCustomVoiceList(AI_PLAYER.getCustomVoicesWith(value, AI_PLAYER.getGender()), !value);
  if (!AI_PLAYER.setCustomVoiceForLanguage(value)) {
    showPop('Error', `setCustomVoiceForLanguage("${value}")`);
  }

  makeTextList(await AI_PLAYER.getSampleTextList());
}

async function selectCustomVoice() {
  const value = $('#customVoiceList option:selected').val();
  if (!AI_PLAYER.setCustomVoice(AI_PLAYER.findCustomVoice(value))) {
    showPop('Error', `setCustomVoice("${value}")`);
  }

  makeTextList(await AI_PLAYER.getSampleTextList());
}

function initUI(aiType) {
  $('#xControl').val(0);
  $('#yControl').val(0);
  $('#scaleControl').val(1);
  $('#speedControl').val(1);

  switch (aiType) {
    case '3D':
      $('.configLayout').hide();
      $('.ToolBoxContainer').css('height', '43vh');
      $('.ToolBoxContainer').css('min-height', '240px');
      break;
    case '2D':
      $('.configLayout').show();
      $('.ToolBoxContainer').css('height', '52vh');
      $('.ToolBoxContainer').css('min-height', '300px');
      break;
  }
}

async function makeAIList(ais = []) {
  $('#aiList option').remove();

  let isStarted = false;

  for (let i = 0; i < ais.length; i++) {
    const ai = ais[i];
    const option = document.createElement('option');
    option.value = ai.aiName;
    option.innerText = ai.aiDisplayName;
    option.setAttribute('language', ai.language);
    option.setAttribute('type', ai.aiType);

    if (ai.aiName === initAiName) {
      isStarted = true;
      option.setAttribute('selected', '');
      await startAI(ai.aiName, ai.aiType);
    }

    if (i == ais.length - 1 && !isStarted) {
      const firstAI = ais[0];
      await startAI(firstAI.aiName, firstAI.aiType);
    }

    $('#aiList').append(option);
  }
}

function makeTextList(texts = []) {
  $('#sampleText option').remove();

  let option = document.createElement('option');
  option.value = 'backend';
  option.innerHTML = 'Please Choose...';
  option.setAttribute('disabled', '');
  option.setAttribute('selected', '');
  option.setAttribute('hidden', '');

  $('#sampleText').append(option);
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    option = document.createElement('option');
    option.value = text;
    option.innerText = text;
    // if (i === 0) {
    //   option.setAttribute('selected', '');
    // }

    $('#sampleText').append(option);
  }

  option = document.createElement('option');
  option.value = '';
  option.innerHTML = 'No Sentence';

  $('#sampleText').append(option);
}

function makeCustomVoiceLanguageList(languages = []) {
  $('#customVoiceLanguageList option').remove();

  let option = document.createElement('option');
  option.value = '';
  option.innerHTML = 'Default';
  option.setAttribute('selected', '');
  $('#customVoiceLanguageList').append(option);

  for (let i = 0; i < languages.length; i++) {
    option = document.createElement('option');
    option.value = languages[i];
    option.innerText = languages[i];

    $('#customVoiceLanguageList').append(option);
  }
}

function makeCustomVoiceList(customVoices = [], isDefault = false) {
  $('#customVoiceList option').remove();

  let option;
  if (isDefault) {
    option = document.createElement('option');
    option.value = '';
    option.innerHTML = 'Default Voice';
    option.setAttribute('selected', '');
    $('#customVoiceList').append(option);
  }

  for (let i = 0; i < customVoices.length; i++) {
    const { id, name, language } = customVoices[i];
    option = document.createElement('option');
    option.value = id;
    option.innerText = `${name}(${language})`;

    $('#customVoiceList').append(option);
  }
}

function makeGestureList(gestures = []) {
  $('#gestureSelect option').remove();

  let option = document.createElement('option');
  option.value = 'backend';
  option.textContent = 'Please Choose...';
  option.setAttribute('disabled', '');
  option.setAttribute('selected', '');
  option.setAttribute('hidden', '');

  $('#gestureSelect').append(option);

  for (let gesture of gestures) {
    option = document.createElement('option');
    option.value = gesture.gst;
    option.textContent = gesture.gst;

    $('#gestureSelect').append(option);
  }

  option = document.createElement('option');
  option.value = 'backend';
  option.textContent = 'No Gesture';

  $('#gestureSelect').append(option);
}

function showPop(title = 'Error', content = 'Unknown Error') {
  $('#popTitle').html(title);
  $('#popContent').html(content);
  $('#popModel').css('display', '');
}

function closePop() {
  $('#popModel').css('display', 'none');
}

// =========================== ETC ================================ //

async function makeRequest(method, url, params) {
  const options = { method, headers: { 'Content-Type': 'application/json; charSet=utf-8' } };

  if (method === 'POST') options.body = JSON.stringify(params || {});

  return fetch(url, options)
    .then((response) => response.json())
    .then((data) => data)
    .catch((error) => {
      console.error('** An error occurred during the fetch', error);
      showPop('Generate Client Token Error', 'no client token can be generated.');
      return undefined;
    });
}
