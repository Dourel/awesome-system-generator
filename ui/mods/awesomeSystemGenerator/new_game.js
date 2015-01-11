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

    var biomes = [];
    for (var i = 0; i < $('input#normal-planets').val(); i++) {
        biomes.push(['earth', 'desert', 'lava', 'tropical']);
    }
    for (var i = 0; i < $('input#gas-giants').val(); i++) {
        biomes.push(['gas']);
    }
    for (var i = 0; i < $('input#metal-planets').val(); i++) {
        biomes.push(['metal']);
    }
    biomes = _.shuffle(biomes);
    var cSys = { Planets: []};
    for (var i = 0; i < biomes.length; i++) {
        var theta = getRandomInt(0, 5) / 360 * 2 * Math.PI;
        var r = 12000 + 5000*i;
        var v = Math.sqrt(5e8 / r);
        console.log(theta + ',' + r + ',' + v)
        var p =  {
                starting_planet: true,
                mass: 50000,
                Thrust: [0, 0],
                Radius: [150, 250],
                Height: [20, 25],
                Water: [33, 35],
                Temp: [0, 100],
                MetalDensity: [25, 50],
                MetalClusters: [0, 24],
                BiomeScale: [100, 100],
                Position: [r * Math.cos(theta), r * Math.sin(theta)],
                Velocity: [v * Math.sin(theta), v * Math.cos(theta)],
                Biomes: biomes[i]};
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
    addControl('normal-planets', 'Normal Planets', 3);
    addControl('metal-planets', 'Metal Planets', 0);
    addControl('gas-giants', 'Gas Giants', 0);
});
