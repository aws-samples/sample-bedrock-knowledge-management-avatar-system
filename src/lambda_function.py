# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os
import boto3
import random
import logging
import time
import uuid
import base64
import botocore
#

from botocore.client import Config
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from botocore.exceptions import WaiterError
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta

#

dynamodb = boto3.resource('dynamodb')
polly_client = boto3.client('polly')

bedclient = boto3.client('bedrock')
bedrock_runtime =  boto3.client('bedrock-runtime', region_name="us-east-1")
#
s3 = boto3.resource('s3')
s3_client = boto3.client('s3')#, config=Config(signature_version='s3v4'))
bedrun = boto3.client('bedrock-runtime',region_name='us-east-1')


def bed_getmodels(modelIdentifier):
    resp  = bedclient.get_foundation_model(modelIdentifier=modelIdentifier)['modelDetails']
    #GetFoundationModelAvailability
    return resp
def bed_listmodels(event):
    _ar=0
    resp = bedclient.list_foundation_models()['modelSummaries']
    
    bucket= event['bucket']
    modelId = event['modelid']
    fmlistkey = f"{event['prefix']}data/fmlist.json"
    bucket_putpriv(bucket, fmlistkey, json.dumps(resp,indent=2),"text/json")
    return resp
def bucket_get_obj(bucket, bkey):
    object = s3_client.get_object(Bucket=bucket, Key=bkey)
    return(object['Body'].read().decode('utf-8'))
def bucket_putpriv(bucket, key, body,type):
    srep = s3_client.put_object(
        ACL='private', Body=body, Bucket=bucket, Key=key, ContentType=type,)
    #print(srep)
    return srep    
def gen_surl(bucketname, keyname):
    url = s3_client.generate_presigned_url(ClientMethod='get_object', Params={'Bucket': bucketname, 'Key': keyname})
    return url
def bucket_key_exist(bucket,key):
    _ret=True
    try:
        rep = s3_client.get_object(Bucket=bucket, Key=key)
    except botocore.exceptions.ClientError as e:
        print(e.response['Error']['Code'])
        _ret= False
        if e.response['Error']['Code'] == "404":
            print(e.response['Error']['Code'])
            _ret= False
            
        else:
            # Something else has gone wrong.
            print(e.response['Error']['Code'])
    return _ret
def bed_titan_imginvoke(event):
    ret={}
    image_url='404'
    errmess=''
    #
    _rand  = random.randint(10, 24200)
    _text = event['text_prompt']
    style_preset =  event['pstyle']
    gseed = event['seed']
    bucket= event['bucket']
    #steps = event['steps']
    modelId = event['modelid']
    #'amazon.titan-image-generator-v1'
    _text = _text +' '+style_preset
    IMAGE_NAME = f"{event['prefix']}{event['imgprefix']}titan_{_rand}.png"
    payload = {"textToImageParams":{"text":_text},"taskType":"TEXT_IMAGE","imageGenerationConfig":{"cfgScale":8,"seed":gseed,"quality":"standard","width":1024,"height":1024,"numberOfImages":1}}
    body = json.dumps(payload)
    
    try:
        response = bedrun.invoke_model(
            accept='application/json',
            body=body,
            contentType='application/json',
            modelId=modelId)
        response_body = json.loads(response.get("body").read())
        base_64_img_str = response_body["images"][0]
        base_64_decoded = base64.b64decode(base_64_img_str)
        bucket_putpriv(bucket, IMAGE_NAME, base_64_decoded,"image/png")
        image_url = gen_surl(bucket, IMAGE_NAME)
    except Exception as e:
        print(type(e))
        print(str(e))
        errmess = str(e)
        
    return {'image_url':image_url,'error':errmess}
def generate_message(bedrun, model_id, system_prompt, messages, max_tokens):

    body=json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "messages": messages
        }  
    )  

    
    response =bedrun.invoke_model(body=body, modelId=model_id)
    response_body = json.loads(response.get('body').read())
   
    return response_body  
def bed_invoke_claude_hai_message(event):
    _ret =""
    #try:
    ###
    ###
    system_prompt=''
    messages =  [
        {
            "role": "user",
            "content": [
            {
                "type": "text",
                "text": event['prompt']
            }
            ]
        }
        ] 
    response = generate_message(bedrun, event['modelid'],system_prompt, messages, 500)
    _ret = response['content'][0]['text']

    
    return _ret
def bed_invoke_sd(event):
    ret={}
    image_url='404'
    errmess=''
    #
    
    _rand  = random.randint(10, 24200)
    _text = event['text_prompt']
    style_preset =  event['pstyle']
    gseed = event['seed']
    bucket= event['bucket']
    steps = event['steps']
    modelId = event['modelid']
    #'amazon.titan-image-generator-v1'
    _text = _text +' '+style_preset
    image_name = f"{event['prefix']}{event['imgprefix']}stabled_{_rand}.png"
    payload = {"text_prompts":[{"text":_text,"weight":1}],"cfg_scale":10,"seed":gseed,"steps":steps,"width":1024,"height":1024}
    body = json.dumps(payload)
    
    try:
        response = bedrun.invoke_model(
            accept='application/json',
            body=body,
            contentType='application/json',
            modelId=modelId)
        response_body = json.loads(response.get("body").read())
        #print(response_body["result"])
        base_64_img_str = response_body["artifacts"][0].get("base64")
        base_64_decoded = base64.b64decode(base_64_img_str)
        bucket_putpriv(bucket, image_name, base_64_decoded,"image/png")
        image_url = gen_surl(bucket, image_name)
    except Exception as e:
        print(type(e))
        print(str(e))
        errmess = str(e)
        
    return {'image_url':image_url,'error':errmess}
def bed_invoke(payload,IMAGE_BUCKET,IMAGE_NAME):
    response = bedrun.invoke_model(
        accept='application/json',
        body=payload,
        contentType='application/json',
        modelId='stability.stable-diffusion-xl')
        
    #stability.stable-diffusion-xl-v0
    print(response)
    return 4
    response_body = json.loads(response.get("body").read())
    #print(response_body["result"])
    base_64_img_str = response_body["artifacts"][0].get("base64")
    base_64_decoded = base64.b64decode(base_64_img_str)
    bucket_putpriv(IMAGE_BUCKET, IMAGE_NAME, base_64_decoded,"image/png")
    image_url = gen_surl(IMAGE_BUCKET, IMAGE_NAME)
    return image_url
def logimg(event):
    log-23
    swbhtmla = f"<img src='{image_url}'><br>{mpayload['textToImageParams']['text']}<br>{swbhtml}"
    bucket_putpriv(bucket, swb, swbhtmla,"text/html")
    psurl = gen_surl(bucketI, swb)
def bed_text_invoke_lamma2(event):
    ret={}

    errmess=''
    #
    _rand  = random.randint(10, 24200)
    payload = {"prompt":event['prompt'],"max_gen_len":1669,"temperature":0.5,"top_p":0.9}
    bucket= event['bucket']
    modelId = event['modelid']
    body = json.dumps(payload)
    
    try:
        response = bedrun.invoke_model(
            accept='application/json',
            body=body,
            contentType='application/json',
            modelId=modelId)
        
        response_body = json.loads(response.get("body").read())
        print(response_body)
       
    except Exception as e:
        print(type(e))
        print(str(e))
        errmess = str(e)
        
    return response_body['generation']
def bed_text_invoke(event):
    ret={}

    errmess=''
    #
    _rand  = random.randint(10, 24200)
    prompt = f"\n\nHuman: {event['prompt']} "
    prompt = prompt + '\n\nAssistant:turn'
    bucket= event['bucket']
    modelId = event['modelid']
    payload = {"prompt":prompt,"max_tokens_to_sample":1700,"temperature":1,"top_k":250,"top_p":0.999,"stop_sequences":["Human:"],"anthropic_version":"bedrock-2023-05-31"}
    body = json.dumps(payload)
    
    try:
        response = bedrun.invoke_model(
            accept='application/json',
            body=body,
            contentType='application/json',
            modelId=modelId)
        
        response_body = json.loads(response.get("body").read())
        print(response_body)
       
    except Exception as e:
        print(type(e))
        print(str(e))
        errmess = str(e)
        
    return response_body['completion']
def bed_text_invoke_anthropic(event):
    ret={}

    errmess=''
    #
    _rand  = random.randint(10, 24200)
    bucket= event['bucket']
    modelId = event['modelid']
    payload = {"prompt":event['prompt'],"maxTokens":1700,"temperature":1,"topP":1,"countPenalty":{"scale":0},"presencePenalty":{"scale":0},"frequencyPenalty":{"scale":0},"stopSequences":[]}
    body = json.dumps(payload)
    
    try:
        response = bedrun.invoke_model(
            accept='application/json',
            body=body,
            contentType='application/json',
            modelId=modelId)
        
        response_body = json.loads(response.get("body").read())
        print(response_body)
       
    except Exception as e:
        print(type(e))
        print(str(e))
        errmess = str(e)
        
        #completions": [
        #{
        #"data": {
        #  "text"
          
    return response_body['completions'][0]['data']['text']
    #lresponse_body['completion']

def get_last_100_prompts(table_name):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    try:
        response = table.scan(
            ProjectionExpression='id, prompt',
            FilterExpression=Attr('prompt').exists(),
            Limit=100
        )

        items = response['Items']

        # Continue scanning if we have more items (pagination)
        while 'LastEvaluatedKey' in response and len(items) < 100:
            response = table.scan(
                ProjectionExpression='id, prompt',
                FilterExpression=Attr('prompt').exists(),
                ExclusiveStartKey=response['LastEvaluatedKey'],
                Limit=100 - len(items)
            )
            items.extend(response['Items'])

        # Sort items by timestamp in descending order (assuming timestamp exists)
        items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        # Return only the first 100 items (or less if there aren't 100)
        return items[:100]

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return []
##dynamodb
def query_similar_prompts(user_prompt, table_name, index_name):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name) 
    # Perform the query
    response = table.query(
        IndexName=index_name,  # The name of your index
        KeyConditionExpression=Key('prompt').eq(user_prompt)
    )
    # Process the results
    items = response['Items']
    if len(items) > 0:
        return items[0]
    else:
        return {}
    
#insert
def insert_record(id,prompt, answer_text, answer_video, table_name):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    # Generate a unique ID for the record
    
    
    timestamp = datetime.utcnow().isoformat()

    try:
        response = table.put_item(
            Item={
                'id': id,
                'prompt': prompt,
                'answer_text': answer_text,
                'answer_audio': answer_video,
                'timestamp': timestamp
            }
        )
        print(response)
        return True
    except ClientError as e:
        print(f"An error occurred: {e.response['Error']['Message']}")
        return False



def pollystartspeech(bucket, prefix, text, voice):
    rep = polly_client.start_speech_synthesis_task(
        Engine='generative',
        OutputFormat='mp3',
        OutputS3BucketName=bucket,
        OutputS3KeyPrefix=prefix,
        Text=text,
        VoiceId=voice
    )
    
    task_id = rep['SynthesisTask']['TaskId']
    waiter = polly_client.get_waiter('speech_synthesis_task_complete')
    
    try:
        waiter.wait(
            TaskId=task_id,
            WaiterConfig={
                'Delay': 2,
                'MaxAttempts': 3
            }
        )
    except WaiterError:
        # Handle timeout or failed synthesis
        pass
        
    return rep['SynthesisTask']['OutputUri']


def dy_get_item(fetchid,table_name):
    # Initialize DynamoDB client
    dynamodb = boto3.resource('dynamodb')
    
    # Specify your table name
    table = dynamodb.Table(table_name)

    
    try:
        # Perform the GetItem operation
        response = table.get_item(
            Key={
                'id': fetchid
            },
            ProjectionExpression='id, answer_text, answer_audio'
        )
        
        # Check if the item was found
        if 'Item' in response:
            item = response['Item']
            print(item)
            #return 3
            return {
           
                 
                    'id': item.get('id'),
                    'answer_text': item.get('answer_text'),
                    'answer_audio': item.get('answer_audio')
                
            }
        else:
            return {
                'statusCode': 404,
                'body': 'Item not found'
            }
    
    except ClientError as e:
        print(e.response['Error']['Message'])
        return {
            'statusCode': 500,
            'body': 'Error retrieving item from DynamoDB'
        }
def mksurl(bucket,s3link):
    bseparator = f"{bucket}/"
    print(bseparator)
    key=s3link.split(bseparator)[1]
    slink = gen_surl(bucket, key)
    return(slink)

def invoke_bedrock_knowledge_base(event):
    # Create a Bedrock Agent Runtime client
    client = boto3.client('bedrock-agent-runtime', region_name='us-east-1')  # Replace with your region

    try:
        # Prepare the request
        request = {
            'input': {
                'text': event['query']
            },
            'retrieveAndGenerateConfiguration': {
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': {
                    'knowledgeBaseId': event['knowledge_base_id'],
                    'modelArn': event['model_arn']
                }
            }
        }

        # Make the API call
        response = client.retrieve_and_generate(**request)

        # Extract and return the generated text
        return response['output']['text']

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return None


def lambda_handler(event, context):


    # TODO implement
    ########
    paudio = False
    print(json.dumps(event))
    # If Lambda Custom Authorizer provides a response override, return response and stop
    if ('requestContext' in event and 'authorizer' in event['requestContext'] and 
        'responseOverrideString' in event['requestContext']['authorizer']):
        return json.loads(event['requestContext']['authorizer']['responseOverrideString'])
    

    bucket = os.environ['bucket']
    prefix = os.environ['prefix']
    TableName = os.environ['TableName'] 
    IndexName = os.environ['IndexName']
    
    imgprefix = f"{prefix}images"  
    
    event['bucket'] = bucket
    event['prefix'] = prefix
    event['imgprefix'] = imgprefix

    if 'body' in event:
        ebody = json.loads(event['body'])
        event['ebody'] = ebody
    else:
        ebody=event

    if 'action' in ebody:
        if 'key' in ebody:
            _ret = gen_surl(bucket, ebody['key'])
            return {
                'statusCode': 200,
                "isBase64Encoded": False,
                "headers": {'ContentType':'application/json','Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'surl':  _ret})
        }
    print(ebody)

 
    print(ebody['fetchid'])

        
    if 'getlast100' in ebody:
        _ret = get_last_100_prompts(TableName)
        print(_ret)
        return {
                'statusCode': 200,
                "isBase64Encoded": False,
                "headers": {'ContentType':'application/json','Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'oldprompts':  _ret})
        }
    #fspi = found similar prompt id
    if len(ebody['fetchid']) > 0:
        #pulling similar from db no scaning
        _dret = dy_get_item(ebody['fetchid'],TableName)
        if paudio == False:
            _audio ='none'
            s_answer_audio = 'none'
        else:
            s_answer_audio = mksurl(bucket,_dret['answer_audio'])
        
        
        return {
            'statusCode': 200,
            "isBase64Encoded": False,
            "headers": {'ContentType':'application/json','Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'returntext':  _dret['answer_text'],'audio': s_answer_audio,'id':ebody['fetchid'],'idtype':'old'})
    }


     
 
    #
    _dbcheck = query_similar_prompts(ebody['query'], TableName, IndexName)
    if 'id' in _dbcheck:
        rtext = _dbcheck['answer_text'] +' db :-)'
        id = _dbcheck['id']
        if paudio == False:
            _audio ='none'
            s_answer_audio = 'none'
        else:
            _audio =_dbcheck['answer_audio']
            s_answer_audio = mksurl(bucket,_audio)


    else:
        kb_event={'query':ebody['query'],'model_arn':ebody['model_arn'], 'knowledge_base_id': ebody['knowledge_base_id']}
        rtext = invoke_bedrock_knowledge_base(kb_event)
        print(rtext)
        if paudio == False:
            audio_prefix=f"{prefix}audio/"
            voice = ebody['voice']
            _audio = 'none'
            s_answer_audio = 'none'
        else:
            audio_prefix=f"{prefix}audio/"
            voice = ebody['voice']
            _audio = pollystartspeech(bucket,audio_prefix,rtext,voice)
            s_answer_audio = mksurl(bucket,_audio)

        id = str(uuid.uuid4())
        success = insert_record(id,ebody['query'],rtext,_audio,TableName)
        if success:
            print("Record inserted successfully.")
        else:
            print("Failed to insert record.")
        ###`


    
    return {
            'statusCode': 200,
            "isBase64Encoded": False,
            "headers": {'ContentType':'application/json','Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'returntext':  rtext, 'audio': s_answer_audio,'id':id,'idtype':'new'})
    }