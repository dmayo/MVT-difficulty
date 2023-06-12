/**
 * Created by Qisheng Li in 11/2019.
 */

//Store all the configuration data in variable 'data'
var data = {"dataType":"configurationData"};
data["ballPosition"] = [];
data["fullScreenClicked"] = false;
data["sliderClicked"] = false;

(function ( distanceSetup, $ ) {

    distanceSetup.round = function(value, decimals) {
        return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
    };

    distanceSetup.px2mm = function(cardImageWidth) {
        const cardWidth = 85.6; //card dimension: 85.60 × 53.98 mm (3.370 × 2.125 in)
        var px2mm = cardImageWidth/cardWidth;
        data["px2mm"] = distanceSetup.round(px2mm, 4);
        return px2mm;
    };


}( window.distanceSetup = window.distanceSetup || {}, jQuery));


function getCardWidth() {
    var cardWidthPx = $('#card').width();
    data["cardWidthPx"] = distanceSetup.round(cardWidthPx,2);
    return cardWidthPx
}


function configureBlindSpot() {

    drawBall();
    nextState();
    $('#blind-spot').css({'display':'block'});
    $(document).on('keydown', recordPosition);

};


$( function() {
    $( "#slider" ).slider({value:"50","step":.1});
} );

$(document).ready(function() {
    $( "#slider" ).on("slide", function (event, ui) {
        var cardWidth = ui.value + "%";
        $("#card").css({"width":cardWidth});
    });

    $('#slider').on('slidechange', function(event, ui){
        data["sliderClicked"] = true;
    });

});


//=============================
//Ball Animation

function drawBall(pos=200){
    // pos: define where the fixation square should be.
    var mySVG = SVG("svgDiv");
    const cardWidthPx = getCardWidth();
    //console.log(screen.width*distanceSetup.px2mm(cardWidthPx));

    const rectX = distanceSetup.px2mm(cardWidthPx)*pos;
    //const rect = distanceSetup.px2mm(cardWidthPx)*pos; ////////
    //const rectX = 2000////////////
    console.log("rectx", rectX);
    console.log("window", window);
    console.log("px2mm",data["px2mm"])
    
    const ballX = rectX*0.6; // define where the ball is
    //const ballX = rectX - 100 ////////////
    var ball = mySVG.circle(30).move(ballX, 50).fill("#f00");
    window.ball = ball;
    var square = mySVG.rect(30, 30).move(Math.min(rectX - 50, 950), 50); //square position
    //var square = mySVG.rect(30, 30).move(rectX - 50, 50); //square position //////////////////////
    //var line = mySVG.rect(3, 60).move(0, 35);
    var line = mySVG.rect(3, 60).move(0, 35);
    //var line = mySVG.line(0, 50, 10, 10).stroke({ width: 5 }) //black line where the ball animation ends
    data["squarePosition"] = distanceSetup.round(square.cx(),2);
    data['rectX'] = rectX;
    data['ballX'] = ballX;
};


function animateBall(){
    $("#scroll_down").hide();
    window.scrollTo(0,document.body.scrollHeight);
    ball.animate(7000).during(
        function(pos){
            moveX = - pos*data['ballX'];
            window.moveX = moveX;
            moveY = 0;
            ball.attr({transform:"translate("+moveX+","+moveY+")"});

        }
    ).loop(true, false).
    after(function(){
        animateBall();
    });

    //disbale the button after clicked once.
    $("#start").attr("disabled", true);
    $("#start").css("visibility", "hidden");
};

function recordPosition(event, angle=13.5) {
    // angle: define horizontal blind spot entry point position in degrees.
    if (event.keyCode == '32') { //Press "Space"

        data["ballPosition"].push(distanceSetup.round((ball.cx() + moveX),2));
        var sum = data["ballPosition"].reduce((a, b) => a + b, 0);
        var ballPosLen = data["ballPosition"].length;
        data["avgBallPos"] = distanceSetup.round(sum/ballPosLen, 2);
        var ball_sqr_distance = (data["squarePosition"]-data["avgBallPos"])/data["px2mm"];
        var viewDistance = ball_sqr_distance/Math.radians(angle)
	console.log("px2mm", data["px2mm"])
	console.log('sqr_pos', data["squarePosition"])
	console.log('avg_pos', data["avgBallPos"])
	console.log('ball_sq', ball_sqr_distance)
	console.log('vd', viewDistance)
        console.log(Math.radians(angle))
	
	data["viewDistance_mm"] = distanceSetup.round(viewDistance, 2);
	
			       

        //counter and stop
        var counter = Number($('#click').text());
        counter = counter - 1;
        $('#click').text(Math.max(counter, 0));
        if (counter <= 0) {

            ball.stop();

            // Disable space key
            $('html').bind('keydown', function(e)
            {
               if (e.keyCode == 32) {return false;}
            });

            // Display data
            $('#info').css("display", "block");
            $('#info-h').append(Math.round(data["viewDistance_mm"]*0.1*0.393701, 3))
            let realWidth = screen.width*(1/data["px2mm"]);
            let realHeight = screen.height*(1/data["px2mm"]);
            let realDiagonal = Math.sqrt(Math.pow(realWidth,2) + Math.pow(realHeight,2))
            $('#info-h-2').append(Math.round(realDiagonal/10*0.393701, 3))
            $('#vision_next').css("display", "block");

            return;
        }

        ball.stop();
        animateBall();
    }
}


//===================
//Helper Functions
function fullScreen(){
    doc = document.documentElement;
    if(doc.requestFullScreen) {
        doc.requestFullScreen();
    } else if(doc.mozRequestFullScreen) {
        doc.mozRequestFullScreen();
    } else if(doc.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT)) {
        doc.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    }
    console.log("doc", doc);
};

function registerClick(){
    data["fullScreenClicked"] = true;
}

// Converts from degrees to radians.
Math.radians = function(degrees) {
  return degrees * Math.PI / 180;
};
