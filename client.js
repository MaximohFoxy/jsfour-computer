let wait = false;
let esxEnabled = false;
let ESX = false;
let steam = null;

// Register NUI callbacks
RegisterNuiCallbackType('jsfour-computer:close');
RegisterNuiCallbackType('jsfour-computer:esx');

// Client connected > request a session token from server
setImmediate(() => {
    emitNet('jsfour-core:connected');
});

// Player connected > send token to NUI
onNet('jsfour-core:session', ( data ) => {
    esxEnabled = data.esx;
    steam = data.steam;

    SendNuiMessage(JSON.stringify({
        action: 'token',
        token: data.token,
        endpoint: data.endpoint,
        esx: data.esx,
        steam: data.steam
    }));
});

// Triggered when a player sends data to another player
onNet('jsfour-core:toNUI', ( data ) => {
    SendNuiMessage(JSON.stringify({
        action: 'toNUI',
        data: data,
    }));
});

// Check distance between the player and the locations
function checkDistance( pos ) {
    let location = false;
    let pedCoords = GetEntityCoords(GetPlayerPed(-1));

    if ( !pos ) {
        Object.keys( locations ).forEach( ( key ) => {
            let distance = GetDistanceBetweenCoords(pedCoords[0], pedCoords[1], pedCoords[2], locations[key].coords.x, locations[key].coords.y, locations[key].coords.z, true)
    
            if ( distance  < locations[key].marker.drawDistance ) {
                location = {
                    distance: distance,
                    key: key,
                }
            }
        });
    } else {
        let distance = GetDistanceBetweenCoords(pedCoords[0], pedCoords[1], pedCoords[2], locations[pos].coords.x, locations[pos].coords.y, locations[pos].coords.z, true)

        location = {
            distance: distance,
            key: pos
        }
    }
    
    return location;
}

// Remove NUI focus on start (incase of a resource restart)
setImmediate(() => {
    SetNuiFocus(false, false);
});

// Keypress event and display marker if enabled in the config. Also loads in ESX if it's installed
setTick(() => {
    if ( esxEnabled ) {
        while ( !ESX ) {
            TriggerEvent('esx:getSharedObject', ( obj ) => {
                ESX = obj;
            });
        }
    }

    if ( displayMarkers ) {
        if ( !wait ) {
            if ( checkDistance() ) {
                // TODO: hints
                let location = locations[checkDistance().key];
                DrawMarker(location.marker.type, location.coords.x, location.coords.y, location.coords.z, 0.0, 0.0, 0.0, 0, 0.0, 0.0, location.marker.size.x, location.marker.size.y, location.marker.size.z, location.marker.color.r, location.marker.color.g, location.marker.color.b, 100, false, true, 2, false, false, false, false);
            } else {
                wait = true;
    
                setTimeout(() => {
                    wait = false;
                }, 1000);
            }
        } 
    }

    if ( IsControlJustReleased(0, key) ) {
        if ( checkDistance() ) {
            SetNuiFocus(true, true);

            let key = checkDistance().key;
            let location = locations[key];

            SendNuiMessage(JSON.stringify({
                action: 'open',
                location: key,
                loginLogo: location.loginLogo,
                loginBackground: location.loginBackground,
                desktopBackground: location.desktopBackground,
                login: location.login,
                run: location.run
            }));
        }
    }
});

// A command that opens the computer if the player is near a location, if enabled in the config
if ( command.enable ) {
    RegisterCommand(command.name, (source, args) => {
        if ( checkDistance() || command.disableDistance ) {
            if ( args[0] ) {
                SetNuiFocus(true, true);

                let key = args[0];
                let location = locations[key];
    
                SendNuiMessage(JSON.stringify({
                    action: 'open',
                    location: key,
                    loginLogo: location.loginLogo,
                    loginBackground: location.loginBackground,
                    desktopBackground: location.desktopBackground,
                    login: location.login,
                    run: location.run
                }));
            } else {
                console.error(`Command missing arguments, usage: /${ command.name } location`);
            }
        }
    });
}

// Remove NUI focus < called from NUI
on("__cfx_nui:jsfour-computer:close", ( data, cb ) => {
    SetNuiFocus(false, false);
    cb(true);
});

// ESX functions required by some ESX programs, will only work if ESX has been installed
on("__cfx_nui:jsfour-computer:esx", ( data, cb ) => {
    switch ( data.function ) {
        case 'society':
            switch ( data.event ) {
                case 'getMoney': 
                    ESX.TriggerServerCallback('esx_society:getSocietyMoney', ( money ) => {
                        cb( money );
                    }, data.job);
                    break;
                case 'withdraw':
                    emitNet('esx_society:withdrawMoney', data.job, data.amount);
                    cb(true);
                    break;
                case 'deposit':
                    emitNet('esx_society:depositMoney', data.job, data.amount);
                    cb(true);
                    break;
                case 'getEmployees':
                    ESX.TriggerServerCallback('esx_society:getEmployees', ( employees ) => {
                        cb( employees );
                    }, data.job);
                    break;
                case 'getJob':
                    ESX.TriggerServerCallback('esx_society:getJob', ( job ) => {
                        cb( job.grades );
                    }, data.job);
                    break;
                case 'setSalary':
                    ESX.TriggerServerCallback('esx_society:setJobSalary', function() {
                        cb(true);
                    }, data.job, data.grade, data.amount);
                    break;
                case 'fire':
                    ESX.TriggerServerCallback('esx_society:setJob', function() {
                        cb(true);
                    }, data.identifier, 'unemployed', 0, 'fire');
                    break;
                case 'changeGrade':
                    ESX.TriggerServerCallback('esx_society:setJob', function() {
                        cb(true);
                    }, data.identifier, data.job, data.grade, 'promote');
                    break;
            }
            break;
    }
});
