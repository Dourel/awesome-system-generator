model.loadRandomSystem = function() {
    var self = model;
    var generatorConfig = {
        seed: Math.random(),
        players: 2
    };

    return generateSystem(generatorConfig).then(function (system) {
            UberUtility.unfixupPlanetConfig(system);

            self.loadedSystem(system);
            self.updateSystem();
            self.requestUpdateCheatConfig();
        });
}

var generateSystem = function(config) {
    var rng = new Math.seedrandom(config.seed !== undefined ? config.seed : Math.random());
    var getRandomInt = function (min, max) {
        return Math.floor(rng() * (max - min + 1)) + min;
    };

    var rSystem = {
        name: 'Awesome System ' + getRandomInt(100, 30000),
        isRandomlyGenerated: true,
        Players: [2, 10]
    };

    var nLarge = parseInt($('input#large-planets').val());
    var nMedium = parseInt($('input#medium-planets').val());
    var nSmall = parseInt($('input#small-planets').val());
    var nTiny = parseInt($('input#tiny-planets').val());
    var nGas = parseInt($('input#gas-giants').val()); // adds an extra 'large'
    var nMetal = parseInt($('input#metal-planets').val()); // small, medium, or large
    var nStart = parseInt($('input#start-planets').val()); // small, medium, and large
    var nLaunch = parseInt($('input#launchable-planets').val()); // small and tiny

    var specs = [];

    // Populate biomes
    for (var i = 0; i < nMetal; i++) {
        specs.push({biome: ['metal']});
    }
    for (var i = 0; i < nGas; i++) {
        specs.push({biome: ['gas'],
                    radius: getRandomInt(1000,1500),
                    mass: 50000});
    }
    for (var i = 0; i < nLarge+nMedium+nSmall+nTiny-nMetal; i++) {
        specs.push({biome: ['earth', 'desert', 'lava', 'tropical']});
    }
    console.log(specs);
    specs = _.shuffle(specs);

    // Populate sizes
    var sizes = [{n:nTiny, m:5000, r1:100, r2:200, bad:'metal'},
                 {n:nSmall, m:10000, r1:200, r2:300, bad:''},
                 {n:nMedium, m:20000, r1:300, r2:500, bad:''},
                 {n:nLarge, m:50000, r1:500, r2:750, bad:''}];

    for (var j = 0; j < sizes.length; j++) {
        var nLeft = sizes[j]['n'];
        for (var i = 0; i < specs.length; i++) {
            if (nLeft == 0) {
                break;
            }
            if (specs[i]['mass'] || specs[i]['biome'][0] == sizes[j]['bad']) {
                continue;
            }
            specs[i]['mass'] = sizes[j]['m'];
            specs[i]['radius'] = getRandomInt(sizes[j]['r1'], sizes[j]['r2']);
            nLeft -= 1;
        }
    }
    specs = _.shuffle(specs);

    // Populate start planets (not 'tiny')
    var nLeft = nStart;
    for (var i = 0; i < specs.length; i++) {
        if (nLeft == 0) {
            break;
        }
        if (specs[i]['biome'][0] == 'gas' || specs[i]['mass'] == 5000) {
            continue;
        }
        specs[i]['start'] = true;
        nLeft -= 1;
    }

    // Populate launchable planets (smallest radius)
    specs = _.sortBy(specs, function(s) { return s['mass'] });
    var nLeft = nLaunch;
    for (var i = 0; i < specs.length; i++) {
        if (nLeft == 0) {
            break;
        }
        if (specs[i]['mass'][0] > 10000) {
            continue;
        }
        specs[i]['launch'] = [2, 4];
        nLeft -= 1;
    }
    specs = _.shuffle(specs);

    var cSys = { Planets: []};
    for (var i = 0; i < specs.length; i++) {
        var theta = getRandomInt(0, 5) / 360 * 2 * Math.PI;
        var r = 12000 + 5000*i;
        var v = Math.sqrt(5e8 / r);
        console.log(theta + ',' + r + ',' + v)
        var p =  {
                starting_planet: specs[i]['start'],
                mass: specs[i]['mass'],
                Thrust: specs[i]['launch'] || [0, 0],
                Radius: [specs[i]['radius'], specs[i]['radius']],
                Height: [20, 25],
                Water: [33, 35],
                Temp: [0, 100],
                MetalDensity: [25, 50],
                MetalClusters: [0, 24],
                BiomeScale: [100, 100],
                Position: [r * Math.cos(theta), r * Math.sin(theta)],
                Velocity: [v * Math.sin(theta), -v * Math.cos(theta)],
                Biomes: specs[i]['biome']};
        cSys['Planets'].push(p);
    }

    var planet_template =
    {
        name: "Default Planet",
        mass: 5000,
        position: [0, 0],
        velocity: [0, 0],
        required_thrust_to_move: 0,
        generator: {
            seed: 15,
            radius: 100,
            heightRange: 25,
            waterHeight: 35,
            temperature: 100,
            metalDensity: 50,
            metalClusters: 50,
            biomeScale: 100,
            biome: "earth"
        }
    };

    // build the planets based on the random numbers in the system template.
    var pgen = _.map(cSys.Planets, function(plnt, index) {
        var bp = _.cloneDeep(planet_template);
        bp.generator.seed = getRandomInt(0, 32767);
        bp.generator.biome = _.sample(plnt.Biomes);

        var biomeGet = $.get('coui://pa/terrain/' + bp.generator.biome + '.json')
            .then(function(data) {
                return JSON.parse(data);
            });
        var nameGet = plnt.name;
        if (!nameGet) {
            nameGet = $.Deferred();
            api.game.getRandomPlanetName().then(function(name) { nameGet.resolve(name); });
        }
        return $.when(biomeGet, nameGet).then(function(biomeInfo, name) {
            var radius_range = biomeInfo.radius_range;
            if (!_.isArray(radius_range))
                radius_range = [100, 1300];

            bp.generator.radius = getRandomInt(Math.max(plnt.Radius[0], radius_range[0]),
                    Math.min(plnt.Radius[1], radius_range[1]));

            bp.generator.heightRange = getRandomInt(plnt.Height[0], plnt.Height[1]);
            bp.generator.waterHeight = getRandomInt(plnt.Water[0], plnt.Water[1]);
            bp.generator.temperature = getRandomInt(plnt.Temp[0], plnt.Temp[1]);
            bp.generator.biomeScale = getRandomInt(plnt.BiomeScale[0], plnt.BiomeScale[1]);
            bp.generator.metalDensity = getRandomInt(plnt.MetalDensity[0], plnt.MetalDensity[1]);
            bp.generator.metalClusters = getRandomInt(plnt.MetalClusters[0], plnt.MetalClusters[1]);
            bp.generator.index = index;
            bp.name = name;
            bp.position = plnt.Position;
            bp.velocity = plnt.Velocity;
            bp.required_thrust_to_move = getRandomInt(plnt.Thrust[0], plnt.Thrust[1]);
            bp.mass = plnt.mass;
            bp.starting_planet = plnt.starting_planet;

            return bp;
        });
    });

    return $.when.apply($, pgen).then(function() {
        rSystem.planets = Array.prototype.slice.call(arguments, 0);
        return rSystem;
    });
};


$(function () {
    var controls = $('<div style="margin-left: 6px;"><table id="ap-controls"></table></div>');
    $('.system-controls').append(controls);

    var table = $('table#ap-controls');
    var addControl = function(id, label, value) {
        var tr = $('<tr></tr>');
        tr.append($('<td style="padding: 6px">' + label + ':</td>'));
        var td = $('<td></td>');
        var i = $('<input type="text" style="width: 3em; text-align:right">');
        tr.append(i);
        i.attr('id', id);
        i.attr('value', value);
        table.append(tr);
    }
    addControl('large-planets', 'Large Planets', 0);
    addControl('medium-planets', 'Medium Planets', 3);
    addControl('small-planets', 'Small Planets', 0);
    addControl('tiny-planets', 'Tiny Planets', 0);
    addControl('gas-giants', 'Gas Giants', 0);
    addControl('metal-planets', 'Metal Planets', 0);
    addControl('start-planets', 'Start Planets', 1);
    addControl('launchable-planets', 'Launchable Planets', 0);
});
