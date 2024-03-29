let mode =  "multiple choice"

function startExperiment(){
    let mm2in = 0.0393701;
    px2mm = data["px2mm"];
    view_distance_mm  = data["viewDistance_mm"];
    let in2px = inches_len => {return inches_len*(1/mm2in)*(px2mm)};
    a = 0.06992; // tangent of 4 degrees to show image at 8 degrees visual angle
    d = view_distance_mm * mm2in;
    q = 1
    padding_fraction = 0;
    videoHeight = Math.round(in2px((2*a*d) / q) * 1/(1 - padding_fraction))
    if(isNaN(videoHeight)){
	videoHeight = 600;
    }

    $("#viewer").height(videoHeight);
    $("#viewer_container").height(videoHeight);
    $("#viewer_container").width((videoHeight*1.5)*(4/3)*(3/4));
    $("#viewer_back").height(videoHeight);
    $("#viewer_back").width((videoHeight*1.5)-1);
    $("#viewer").hide();
    $("#viewer_instructions").show();
    viewerInstructionsState = 0;
    nextViewerState();
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
  videoSrc = $('source', video).attr('src', "experiment_data/videos/"+videos[currentExperiment]["video"]);
  video[0].load();
  $("#viewer_instructions").hide();
  $("#viewer").show();
  video.trigger('play');
}

function buildClassesTable(){
    let numClasses = classes.length
    $("#classes_table").html("");
    let buttonString = "";
    response_options = video_data["classes"]
    buttonString += '<table style="width:400px">';
    num_cols = 3
    num_rows = Math.ceil(numClasses / num_cols );
    for(let i=0;i<num_rows;i++){
	buttonString += '<tr>';
	for(let j=0;j<num_cols;j++){
	    if ((i*num_cols + j) < numClasses){
		buttonString += '<td>'+response_options[i*num_cols+j].replace("_", " ")+'</td>';
	    }
	}
	buttonString += '</tr>';

    }
    buttonString += '</table>';
    $("#classes_table").append(buttonString);
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
    let numClasses = classes.length
    $("#submit_response").prop("disabled",true);
    $("#response_buttons").html("");
    let buttonString = "";


    
    if (mode == "multiple choice") {  
	buttonString += '<div class="row justify-content-md-center" style="font-size:28px;width:1000px;text-align:center;margin: 0 auto;padding-top:30px;">';
	let response_options = videos[currentExperiment-1]["response_options"]
	let label = videos[currentExperiment-1]["label"]
	buttonString += '<table border="1" cellpadding="15px" style="font-size:18px;line-height:22px;">';
	response_options.sort(() => Math.random() - 0.5);

	num_cols = 7
	num_rows = Math.ceil(numClasses / num_cols )
	for(let i=0;i<num_rows;i++){
	    buttonString += '<tr>';
	    for(let j=0;j<num_cols;j++){
		if ((i*num_cols + j) < numClasses){
		    buttonString += '<td height="75px" width="140px" style="cursor:pointer;" onclick=\'$("#response_box").val("'+response_options[i*num_cols+j].replace("_", " ")+'");$("#submit_response").prop("disabled",false);$("#submit_response").focus();\'>'+response_options[i*num_cols+j].replace("_", " ")+'</td>';
		}
	    }
	    buttonString += '</tr>';
	}
        buttonString += '</table>';
        buttonString += '<div style="margin-top:20px;">I saw a <input type="text" id="response_box" READONLY/></div>';
    buttonString += '</div>';
    } 

    $("#response_buttons").append(buttonString);

    $('html').unbind('keydown')
    if (mode == "multiple choice"){
            $( "#response_box" ).autocomplete({
              source: function( request, response ) {
                      var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( request.term ), "i" );
                      response( $.grep( response_options, function( item ){
                          return matcher.test( item );
                  }) );
		  
                  },
                autoFocus: true,
                search: function( event, ui ) {
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
