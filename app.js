/*
PROGRAMMING NOTES:
emit() is basically used to send messages b/w server and client
on() is an event listener

most of the functions here emits an object called data.  One of it's properties is success which is just a boolean value

for asynchronous programming, anytime we use a function that we'll expect to get the result in the future, we use callbacks
*/

/* MongoDB collection structure
    use myGame
    db.createCollection("account")
    db.createCollection("progress")
*/

//For mongoDB
var mongojs = require("mongojs");
//Create connection for mongoDB
var db = mongojs('localhost:27017/myGame', ['account','progress']);

//Only time we'll be using express
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
//End of express


//File communication (Express)
    //Client asks server for a file (Ex: playerImg.png)

//Package communication (Socket.io)
    //Client sends data to server (Ex: Input)
    //Server sends data to client (Ex: Monster position)

var SOCKET_LIST = {};
//var PLAYER_LIST = {}; Previous version of player list.  It's scope is global and we don't want that so we removed it.

//Entity will contain everything that the player and bullets share
var Entity = function () {
    var self = {
        x:250,
        y:250,
        spdX:0,
        spdY:0,
        id:"",
    }

    //Update loop in Entity class
    self.update = function () {
        self.updatePosition();
    }
    self.updatePosition = function () {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    //Standard way to get distance
    self.getDistance = function(pt){
        return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
    }
    return self;
}

var Player = function (id){
    var self = Entity ();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random()),
    //Keyboard Interactivity
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.maxSpd = 10;
    
    var super_update = self.update;
    self.update = function () {
        self.updateSpd();
        super_update(); 
    
        //Where the bullets get created
        if (self.pressingAttack) {
            self.shootBullet(self.mouseAngle);
        }
    }

    self.shootBullet = function(angle){
        var b = Bullet(self.id, angle);
        b.x = self.x;
        b.y = self.y;
    }

    //this function gets called every frame
    //Note there is a limitation in general.  The server doesn't have (or shouldn't have) access to the client
    self.updateSpd = function () {
        if(self.pressingRight)
            self.spdX = self.maxSpd;
        else if(self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;

        if(self.pressingUp)
            self.spdY = -self.maxSpd;
        else if(self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    } 
    Player.list[id] = self;  //Automatically add this player to the PLAYER_LIST

    initPack.player.push({
        id: self.id,
        x: self.x,
        y: self.y,
        number: self.number,
    });

    return self;


}//End of Player class
Player.list = {};
Player.onConnect = function (socket) {
    var player = Player(socket.id);

   //Allows server to know what key the client is pressing
    socket.on('keyPress', function (data) {
        if (data.inputId === 'left')
            player.pressingLeft = data.state;
        else if (data.inputId === 'right')
            player.pressingRight = data.state;
        else if (data.inputId === 'up')
            player.pressingUp = data.state;
        else if (data.inputId === 'down')
            player.pressingDown = data.state;
        else if (data.inputId === 'attack')
            player.pressingAttack = data.state;
        else if (data.inputId === 'mouseAngle')
            player.mouseAngle = data.state;
    });
    
}//onConnect

Player.onDisconnect = function (socket) {
    delete Player.list[socket.io];
    removePack.player.push(socket.id);
}

Player.update = function () {
    //run a package that contains every player in the game
    var pack = [];

    //run for loop that every socket will update the socket x and y
    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        pack.push({
            id: player.id,
            x: player.x,
            y: player.y
        });
    }
    return pack;
}


//Bullet class
var Bullet = function (parent, angle) {
    var self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle/180*Math.PI) * 10;
    self.spdY = Math.sin(angle/180*Math.PI) * 10;
    self.parent = parent;
    self.timer = 0;
    self.toRemove = false;
    var super_update = self.update;
    self.update = function () {
        if(self.timer++ > 100)
            self.toRemove = true;
        super_update();

        for(var i in Player.list){
            var p = Player.list[i];
            //RainingChain says it's not good to hard code this.  Improve this later on
            if (self.getDistance(p) < 32 && self.parent !== p.id){
                //handle collision. ex: hp--;
                self.toRemove = true;
            }
        }
        
        
    }
    Bullet.list[self.id] = self;
    initPack.bullet.push({
        id: self.id,
        x: self.x,
        y: self.y,
    });
    return self;
}//Bullet Class

Bullet.list = {};

Bullet.update = function () {

    //run a package that contains every player in the game
    var pack = [];

    //run for loop that every socket will update the socket x and y
    for (var i in Bullet.list) {
        var bullet = Bullet.list[i];
        bullet.update();
        if(bullet.toRemove){
            delete Bullet.list[i];
            removePack.bullet.push(bullet.id);
        } else
            pack.push({
                id: bullet.id,
                x: bullet.x,
                y: bullet.y
            });
    }
    return pack;
}

//Used to enable the debugging functions (make sure to set this to false if release publicly!)
var DEBUG = true;

//Object that contains every user
var USERS = {
    //username:password
    "bob":"asd",
    "bob2":"bob",
    "bob3":"ttt"
};

//data is object with properties username and password
//cb is the callback
var isValidPassword = function (data,cb) {
    db.account.find({username:data.username, password:data.password}, function(err,res){ //callback functions always start with error and a result in paramter
        if(res.length > 0) //If there has been a match in db
            cb(true);
        else
            cb(false);
    });
}
var isUsernameTaken = function (data,cb) {
    db.account.find({username:data.username}, function (err,res) {
        if(res.length > 0)
            cb(true);
        else
            cb(false);
    });
}   
var addUser = function (data,cb) {
    db.account.insert({ username: data.username, password: data.password }, function (err) { //no res for insertion
        cb();
    });
}


//socket.io
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
    //console.log('Server Started');
    console.log('Client Connected');
    socket.id = Math.random(); //assign a random, unique id to the socket

   //Add to the list of sockets
    SOCKET_LIST[socket.id] = socket;

    //When a player signs in, create the player
    socket.on('signIn', function (data) {
        isValidPassword(data, function(res) {
            if(res){
                Player.onConnect(socket);
                socket.emit('signInResponse', { success: true });
            } else {
                socket.emit('signInResponse', {success:false});
            }       
        });
    });

    socket.on('signUp', function (data) {
        isUsernameTaken(data, function(res) {
            if(res){
                socket.emit('signUpResponse', { success: false });
            } else {
                addUser(data,function (){
                    xsocket.emit('signUpResponse', { success: true });
                });
            }
        });
    });

    //Listen for a client disconnecting
    socket.on('disconnect', function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    //Listen for messages from clients
    socket.on('sendMsgToServer', function(data){
        var playerName = ("" + socket.id).slice(2,7);
        for(var i in SOCKET_LIST){
            SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
        }
        
    });

    //Listen for debugging messages from clients
    socket.on('evalServer',function(data){
        if(!DEBUG)
            return;
        
        var res = eval(data);
        socket.emit('evalAnswer', res)
    });

 
/*
    //Listening if client sent a happy message
    socket.on('happy', function(data){
        console.log('happy because' + data.reason);
    });

    //Example of the server sending a message to a client
    socket.emit('serverMsg',{
        msg:'hello'
    })
});

*/

}); //io.socket.on('connection')


var initPack = {player: [], bullet:[]};
var removePack = {player: [], bullet:[]};

//Run a loop    NOTE:  There's a better way to do this.  Make this better after tutorial
setInterval(function() {
    var pack = {
        player:Player.update(),
        bullet:Bullet.update(),
    }
    //Basically, every frame, we're sending the init, update, and remove pack.  Then we reset it afterwards
    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('init', initPack);
        socket.emit('update',pack);
        socket.emit('remove', removePack);
    }

    //Resetting the packages
    initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];


}, 1000/25); //runs at 25 fps or every 40 ms