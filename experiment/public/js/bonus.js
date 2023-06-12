let mode =  "multiple choice"//"free response"
let numClasses = 50 //30
function startExperiment(){
  //console.log("here",data["px2mm"]);
  let mm2in = 0.0393701;
  let in2px = inches_len => {return inches_len*(1/mm2in)*(data["px2mm"])};
  //console.log(in2px(6));
  //videoHeight = in2px(5);
  a = 0.069813; // 4 degrees
  d = data["viewDistance_mm"]*0.1*0.393701;
  q = 0.7 //  padding_fraction = 2/3;
  padding_fraction = 0;
  videoHeight = in2px((2*a*d) / q) * 1/(1 - padding_fraction)

  //for debugging purposes
  if(isNaN(videoHeight)){
    videoHeight = 600;
  }
  console.log("video height",videoHeight);

  $("#viewer").height(videoHeight);
  $("#viewer_container").height(videoHeight);
  $("#viewer_container").width((videoHeight*1.5)*(4/3)*(3/4));
  $("#viewer_back").height(videoHeight);
  $("#viewer_back").width((videoHeight*1.5)-1);
  //let video = $('#viewer')
  //videoSrc = $('source', video).attr('src', "videos/"+videos[currentExperiment]);
  //video[0].load();
  $("#viewer").hide();
  $("#viewer_instructions").show();
  viewerInstructionsState = 0;
  nextViewerState();

  //$('#viewer').on('ended',function(){
  //  setTimeout(nextState(), 7000);
  //});
}
function nextViewerState(){
  if (viewerInstructionsState==viewerInstructions.length){
    nextState();
    return;
  }
  $("#viewer_instructions").html('<img src="'+viewerInstructions[viewerInstructionsState]+'" height="'+videoHeight+'" />');
  viewerInstructionsState++;
  if(viewerInstructionsState==viewerInstructions.length-1){
    $("#viewer_next_button").hide();
    $("#viewer_play_button").show();
    $("#viewer_play_button").focus();
  }
  else{
    $('#viewer').hide();
    $('#viewer_instructions').show();
    $("#viewer_play_button").hide();
    $("#viewer_next_button").show();
    $("#viewer_next_button").focus();
  }
}


function startExperimentVideo(){
  $("#viewer_play_button").hide();
  let video = $('#viewer');
  console.log('video', video);
  videoSrc = $('source', video).attr('src', "experiment_data/videos/"+videos[currentExperiment]);
  video[0].load();
  $("#viewer_instructions").hide();
  $("#viewer").show();
  video.trigger('play');
}



// highlight autocompleted text
$.ui.autocomplete.prototype._renderItem = function (ul, item) {        
    var t = String(item.value).replace(
            new RegExp(this.term, "gi"),
            "<strong>$&</strong>");
    return $("<li></li>")
        .data("item.autocomplete", item)
        .append("<div>" + t + "</div>")
        .appendTo(ul);
};


function startExampleVideo(){
  let video = $('#example');
  videoSrc = $('source', video).attr('src', "images/example_video.mp4");
  video[0].load();
  $("#example").show();
  video.trigger('play');
}

function startResponse(){
  //console.log(currentExperiment-1,videos[currentExperiment-1]["label"]);
  $("#submit_response").prop("disabled",true);
  $("#response_buttons").html("");
  let buttonString = "";
  /*
  //select an alternate choice that is not
  //the same as the right answer
  let alternate = "";
  do {
    alternate = imagenet_labels[Math.floor(Math.random() * imagenet_labels.length)];
  } while (alternate == videos[currentExperiment-1]["label"]);

  let response_options = [videos[currentExperiment-1]["label"],alternate];
  if(Math.random()>.5){
    response_options = response_options.reverse();
  }
    
    //two response button options
  buttonString += '<div class="row justify-content-md-center" style="font-size:28px;width:600px;text-align:center;margin: 0 auto;padding-top:30px;">';
  for(let i=0;i<response_options.length;i++){
    buttonString += '<div class="col" style="cursor:pointer;" onclick=\'$("#r'+i+'").prop("checked",true);$("#submit_response").prop("disabled",false);\'>';
      buttonString += '<input type="radio" onclick=\'$("#submit_response").prop("disabled",false);\' id="r'+i+'" name="response" value="'+response_options[i]+'"><br />';
      buttonString += response_options[i];
      //$("#response_buttons").append('<br /><br />');
    buttonString += '</div>';
    //$("#response_buttons").append("<button>"+response_options[currentExperiment-1][i]+"</button>");
  }
  buttonString += '</div>';
  */
    //30 response button options
    ////////////
    ////////////
    if (mode == "multiple choice") {  
  buttonString += '<div class="row justify-content-md-center" style="font-size:28px;width:600px;text-align:center;margin: 0 auto;padding-top:30px;">';

//response_options = ['Alarm clock', 'Banana', 'Bath towel', 'Broom', 'Candle', 'Desk lamp', 'Drill', 'Envelope', 'Frying pan', 'Hair dryer', 'Hammer', 'Helmet', 'Ladle', 'Match', 'Microwave', 'Orange', 'Pillow', 'Plunger', 'Running shoe', 'Safety pin', 'Sleeping bag', 'Soap dispenser', 'Sock', 'Speaker', 'Sunglasses', 'Sweater', 'Tennis racket', 'Umbrella', 'Wallet', 'Weight (exercise)']
	response_options = videos[currentExperiment-1]["response_options"]
	response_options = response_options.sort(() => Math.random() - 0.5)
	//shuffle(response_options)
    
	buttonString += '<table border="1" cellpadding="15px" style="font-size:18px;line-height:22px;">';

num_cols = 8
num_rows = Math.ceil(numClasses / num_cols )
for(let i=0;i<num_rows;i++){
    buttonString += '<tr>';
    for(let j=0;j<num_cols;j++){
        //buttonString += '<div class="col">';
        //buttonString += '<input type="radio" onclick=\'$("#submit_response").prop("disabled",false);\' id="r'+i+'" name="response" value="'+response_options[i]+'"><br />';
        if ((i*num_cols + j) < numClasses){
            buttonString += '<td height="75px" width="140px" style="cursor:pointer;" onclick=\'$("#response_box").val("'+response_options[i*num_cols+j]+'");$("#submit_response").prop("disabled",false);$("#submit_response").focus();\'>'+response_options[i*num_cols+j]+'</td>';
        }
          //$("#response_buttons").append('<br /><br />');
        //buttonString += '</div>';
        //$("#response_buttons").append("<button>"+response_options[currentExperiment-1][i]+"</button>");
    }
    buttonString += '</tr>';
  }
        buttonString += '</table>';
        buttonString += '<div style="margin-top:20px;">I saw a <input type="text" id="response_box" /></div>';
    buttonString += '</div>';
    } else if (mode == "free response") {
    buttonString += '<div style="margin-top:20px;">I saw a <input type="text" id="response_box" /></div>';
    //buttonString += '</div>';
}

    $("#response_buttons").append(buttonString);
    //    $(document).unbind("keyup");
    $('html').unbind('keydown')//, function(e)
//            {
//               if (e.keyCode == 32) {return false;}
//            });
    if (mode == "multiple choice"){
            $( "#response_box" ).autocomplete({
              source: function( request, response ) {
                      // var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( request.term ), "i" );
                      // response( $.grep( response_options, function( item ){
                      //     return matcher.test( item );
                  // }) );
		  
                  },
                autoFocus: true,
                search: function( event, ui ) {
                    console.log("triggered");
                    console.log($("#response_box").val());
                    console.log(response_options.includes($("#response_box").val()));
                    if(response_options.includes($("#response_box").val())){
                       $("#submit_response").prop("disabled",false);
                    }
                    else{
                        $("#submit_response").prop("disabled",true);
                    }
                },
                select: function( event, ui ) {
                    console.log("selected");
                    $("#submit_response").prop("disabled",false);
                    $("#submit_response").focus();
                },
                delay: 0
            });
    } else {
        
        $( "#response_box" ).autocomplete({
              source: function( request, response ) {
                      var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( request.term ), "i" );
                      response( $.grep( [], function( item ){
                          return matcher.test( item );
                      }) );
                  },
                autoFocus: true,
                search: function( event, ui ) {
                    console.log("triggered");
                    console.log($("#response_box").val());
                    if("" != $("#response_box").val()){
                       $("#submit_response").prop("disabled",false);
                    }
                    else{
                        $("#submit_response").prop("disabled",true);
                    }
                },
                select: function( event, ui ) {
                    console.log("selected");
                    $("#submit_response").prop("disabled",false);
                    $("#submit_response").focus();
                },
	        delay: 0
            });
        
    }
  $("#response_box").focus();
  response_start_time = new Date().getTime();
}
