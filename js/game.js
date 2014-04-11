
;( function() {
	"use strict"
} )()

var can = document.getElementById("canvas")
var ctx = can.getContext("2d")

const clog = console.log











const constants = ( function () {

	var self = {}

	self.frameTime    = 1000 / 60

	self.pixelDx      = -1.4                        // the change in the x position of scrolling elements.
	self.flyingBirdDx = 0.75                        // the change in x position of the flying bird.
	self.epsilon      = 0.00000001                  // a very small number, for use in numeric derivatives.

	self.debug        = true

	self.cloudWidth   = 200                         // the pixel width of each cloud.
	self.cloudHeight  = 140 / Math.pow(1.618, 3)    // the pixel height of each cloud.

	self.gravity      = 9.81 / 60                   // the gravitational acceleration.

	self.colours = {
		blue: "#3498db",
		white: "#ecf0f1",
		black: "black"
	}

	self.heroWidth    = 32                          // the width of the hero's collision box.
	self.heroHeight   = 32                          // the height of the hero's collision box.

	self.bound =  {
		x0: -self.cloudWidth,                       // the left outer bound.
		x1: can.width + self.cloudWidth,            // the right outer bound.
		y0: -50,                                    // the top of the screen.
		y1: can.height + 50,                        // the bottom of the screen.
	}


	self.score = {
		x: 100,                                     // the x position of the score number.
		y: 50                                       // the y position of the score number.
	}

	self.cloudRange = {
		y0: 0.150,
		y1: 0.875
	}

	return self

} )()










const utils = ( function () {

	var self = {}

	self.getTime = () => {
		return (new Date).getTime()
	}

	self.isEmpty = obj => {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				return false
			}
		}
		return true
	}

	self.randBetween = (lower, upper) => {
		return (Math.random() * (upper-lower)) + lower
	}

	self.asCanvasMouseCoords =
		(x, y) => {
			return {
				x: x - can.offsetLeft,
				y: y - can.offsetTop
			}
		}

	return self

} )()
















/*
	motion

	closed function of time, that describe the position
*/
const motion = ( function () {

	const flying  = self => {
		return (step, reflect = false) => {

			self.vx   = self.vx   || 0
			self.vy   = self.vy   || 0

			self.ax = self.ax     || 0
			self.ay = self.ay     || 0

			self.init = self.init || 0

			if (reflect) {
				return self
			}

			const dt = step - self.init
			const dy = 7 * Math.sin(step / 30)

			const x0 = self.x0 + (self.vx * dt)
			const x1 = self.x1 + (self.vx * dt)

			const y0 = self.y0 + dy
			const y1 = self.y1 + dy

			return {
				x0: x0,	x1: x1,
				y0: y0,	y1: y1
			}

		}
	}

	const falling = self => {
		return (step, reflect = false) => {

			self.vx = self.vx || 0
			self.vy = self.vy || 0

			self.ax = self.ax || 0
			self.ay = self.ay || 0

			if (reflect) {
				return self
			}

			const dt = step - self.init

			const x0 = self.x0 + (self.vx * dt) + (0.5 * self.ax * (dt * dt))
			const x1 = self.x1 + (self.vx * dt) + (0.5 * self.ax * (dt * dt))

			const y0 = self.y1 + (self.vy * dt) + (0.5 * self.ay * (dt * dt))
			const y1 = self.y1 + (self.vy * dt) + (0.5 * self.ay * (dt * dt))

			return {
				x0: x0,	x1: x1,
				y0: y0,	y1: y1
			}
		}
	}

	/* ----------------- Unit Tests ----------------- */

	const assert = console.assert

	const leftMotion = falling({
		x0: 0, x1: 0,
		y0: 0, y1: 0,

		vx: -1, init: 0
	})

	for (var ith = 0; ith < 100; ith++) {

		var pos = leftMotion(ith)
		assert(pos.x0 === -ith)
	}

	return {
		falling: falling,
		flying: flying
	}

} )()











// the initial state

var state = ( function () {

	var self = {}

	self.hero = {
		position: motion.flying({
			x0: 10,
			x1: 10 + constants.heroWidth,

			y0: constants.cloudRange.y0,
			y1: constants.cloudRange.y1,

			vx: constants.flyingBirdDx,
			vy: 0,

			init: 0
		}),
		isDead:      false,
		locomotion:  "flying",
		lastCloud:   -1,
		jump:   {}
	}

	self.clouds     = []
	self.reactions  = []
	self.queuedCollision = {}

	self.score      = 0
	self.nextCloud  = 0
	self.currStep   = 1

	return self

} )()










/*
creates a reaction function that accesses and alters part
of the state.
*/
const makeReaction = (gets, sets, reaction) => {

	return state => {

		const visible = gets.map(prop => state[prop])
		const transformed = reaction.apply(null, visible)

		for (var prop of sets) {
			state[prop] = transformed[prop]
		}
		return state
	}
}










/*
	React

	This module returns 'setters' for the game state. Each function
	herein takes a part of the game state, and modifies it. They don't usually
	test if the state should be modified - that task falls on update and currently.
*/
const react = ( function () {

	var self = {}

	/*
	Add a new cloud.
	*/
	self.addClouds = makeReaction(
		['clouds', 'currStep', 'nextCloud'], ['clouds', 'nextCloud'],
		(clouds, currStep, nextCloud) => {

			const y0 = utils.randBetween(
				0.150 * constants.bound.y1 + constants.heroHeight + 10,
				0.875 * constants.bound.y1)

			const y1 = y0 + constants.cloudHeight

			const newCloud = {
				position: motion.falling({
					x0: constants.bound.x1,
					x1: constants.bound.x1 + constants.cloudWidth,
					y0: y0,
					y1: y1,

					vx: constants.pixelDx,

					init: currStep
				}),
				cloudId: nextCloud
			}

			return {
				clouds: clouds.concat([newCloud]),
				nextCloud: nextCloud + 1
			}
		})

	/*
	Remove the clouds that have drifted off-screen.
	*/
	self.removeOldClouds = makeReaction(
		['clouds', 'currStep'], ['clouds'],
		(clouds, currStep) => {

			const filteredClouds = clouds.filter(cloud => {
				return cloud.position(currStep).x0 > constants.bound.x0
			})

			return {
				clouds: filteredClouds
			}
		}
	)

	/*
	Swap the initial flying sin-wave motion function for a
	falling motion function.
	*/
	self.clipWings = makeReaction(
		['hero', 'currStep'], ['hero', 'queuedCollision'],
		(hero, currStep) => {

			hero.locomotion = 'falling'

			const coords = hero.position(currStep)

			const ySlope = ( function () {

				const coords1 = hero.position(currStep + constants.epsilon)

				return (coords.y1 - coords1.y1) / (coords.x1 - coords1.x1)
			} )()

			hero.position = motion.falling({
				x0: coords.x0,
				x1: coords.x1,
				y0: coords.y0,
				y1: coords.y1,

				vx: constants.flyingBirdDx,
				vy: ySlope,

				ay: constants.gravity,

				init: currStep
			})

			return {
				hero: hero,
				queuedCollision: {}
			}
		}
	)

	/*
	Every moving object in the game has a trajectory function.
	Because of this collisions can easily be found before they happen;
	the player trajectory function and each cloud trajectory function can
	be used to checked to see if they intersect at any point.

	If an interection between the player and cloud is found in the future,
	then the player either rebounds (1.), lands on the platform (2.), or


	1, Rebounds. The x component of the birds velocity is reversed.
	2, Lands. The y component of the acceleration and velocities are set
		to zero, and the x component is set to the scroll speed dx.
	3, Falls into oblivion. The trajectory is kept.
	*/

	/*
		for each cloud:
			find the t' that the trajectory shares the same y position as the cloud
			using the quadratic equation.

			If t' isnt in the right range next.

			get the [x0, x1, y0, y1 of the function at this time.
			if


			.5 at ^2 + vt- constant = 0


	*/
	self.scheduleCollision = ( function () {
		/*
		Every moving object in the game has a trajectory function.
		Because of this collisions can easily be found before they happen;
		the player trajectory function and each cloud trajectory function can
		be used to checked to see if they intersect at any point.

		If an interection between the player and cloud is found in the future,
		then the player either rebounds (1.), lands on the platform (2.), or


		1, Rebounds. The x component of the birds velocity is reversed.
		2, Lands. The y component of the acceleration and velocities are set
			to zero, and the x component is set to the scroll speed dx.
		3, Falls into oblivion. The trajectory is kept.
		*/

		/*
			for each cloud:
				find the t' that the trajectory shares the same y position as the cloud
				using the quadratic equation.

				If t' isnt in the right range next.

				get the [x0, x1, y0, y1 of the function at this time.
				if


				.5 at ^2 + vt- constant = 0
		*/

		return makeReaction(
			['hero', 'clouds',  'currStep'], ['queuedCollision'],
			(hero, clouds, currStep) => {

				var collision = {
					time:       Infinity,
					locomotion: "standing",
					position: t => "this function is a stand-in, and will never be called."
				}


				for (cloud of clouds) {

					var cloudCoords = cloud.position(0, true)

					var height = {
						diff:     t => {
							return hero.position(t).y1 - cloudCoords.y0
						},
						diffRate: t => {
							return (height.diff(t + 0.1) - height.diff(t)) / 0.1
						}
					}

					var root = constants.bound.x1

					for (var ith = 0; ith < 500; ith++) {
						root -= height.diff(root) / height.diffRate(root)
					}

					if (root < currStep || root > currStep + 2000) {
						continue
					}

					// set better upper bound
					var futureCloud = cloud.position(root)
					var futureHero  = hero.position(root)

					var isAlignedX =
						(futureHero.x1 > futureCloud.x0) && (futureHero.x0 < futureCloud.x1)

					if (isAlignedX && root < collision.time) {

						collision.time = Math.floor(root)
						collision.locomotion = "standing"

						collision.position = motion.falling({
							x0: futureHero.x0,
							x1: futureHero.x1,

							y0: futureHero.y0,
							y1: futureHero.y1,

							vx: constants.pixelDx,

							init: root
						})
					}

				}

				return {
					queuedCollision: collision
				}

			}
		)

	} )()










	/*
	The pre-calculated collision point has
	been reached, so we need to swap out
	the current player's motion function for
	the pre-computed motion function.
	*/
	self.alterCourse = makeReaction(
		['hero', 'queuedCollision', 'score'], ['hero', 'queuedCollision', 'score'],
		(hero, queuedCollision, score) => {

			hero.position   = queuedCollision.position
			hero.locomotion = queuedCollision.locomotion

			if (hero.lastCloud !== queuedCollision.cloudId) {
				hero.lastCloud   = queuedCollision.cloudId
				score += 1
			}

			return {
				hero: hero,
				queuedCollision: {},
				score: score
			}
		}
	)

	/*
	The player is offscreen; kill the player.
	*/
	self.killHero = makeReaction(
		['hero'], ['hero'],
		(hero) => {

			hero.isDead = true

			return {
				hero: hero
			}
		}
	)

	/*
	register that the jump is beginning at a particular time.
	*/
	self.queueJump = time => {
		return makeReaction(
			['hero'], ['hero'],
			(hero) => {

				if (hero.locomotion === 'standing' || hero.locomotion === 'falling') {
					hero.jump = {
						time: time
					}
				}

				return {
					hero: hero
				}
			}
		)
	}

	/*
	Launch the grouse from a standing posture to
	flying along.
	*/
	self.takeOff = (x, y, time) => {
		return makeReaction(
			['hero', 'currStep'], ['hero'],
			(hero, currStep) => {

				if (hero.locomotion !== "standing") {
					return {
						hero: hero
					}
				}

				const coords = hero.position(currStep)

				const mouse = utils.asCanvasMouseCoords(x, y)

				const dist = {
					x: +Math.abs(mouse.x - coords.x1),
					y: -Math.abs(mouse.y - coords.y1)
				}

				const angle = Math.atan(dist.y / dist.x)
				const holdDuration = time - hero.jump.time

				var velocities = {
					x:
						Math.min((holdDuration * Math.cos(angle)) / 30, 11),
					y:
						Math.min((holdDuration * Math.sin(angle)) / 30, 11)
				}

				hero.position = motion.falling({
					x0: coords.x0,
					x1: coords.x1,

					y0: coords.y0,
					y1: coords.y1,

					vx: velocities.x,
					vy: velocities.y,

					ay: constants.gravity,

					init: currStep
				})

				hero.locomotion = 'falling'
				hero.jump = {}

				return {
					hero: hero
				}
			})
	}

	/*
	Tilt the grouse depending on where the mouse is pointing.
	*/
	self.setAngle = (x, y) => {
		return makeReaction(
			['hero', 'currStep'], ['hero'],
			(hero, currStep) => {

				const heroCoords = hero.position(currStep)
				const mouse      = utils.asCanvasMouseCoords(x, y)

				var dist = {
					x: mouse.x - heroCoords.x1,
					y: mouse.y - heroCoords.y1
				}

				if (dist.y === 0) {
					hero.angle = 0
				} else {
					hero.angle = -Math.atan2(dist.x, dist.y) - 270 * 3.14 / 180
				}

				return {
					hero: hero
				}
			}
		)
	}

	return self

})()












/*
	currently

	This module returns predicates that inspect the
	current state. These are currently used in the drawing
	and updating modules.
*/
const currently = ( function () {

	var self = {}

	/*
	creates a reaction function that accesses and alters part
	of the state.
	*/
	const makePredicate = (gets, inspector) => {

		return state => {
			return inspector.apply(null, gets.map(prop => state[prop]))
		}
	}

	/*
	check if there are clouds on screen.
	*/
	self.isCloudy = makePredicate(['clouds'],
		clouds => clouds.length > 0)

	self.noQueuedCollisions = makePredicate(
		['queuedCollision', 'hero', 'clouds'],
		(queuedCollision, hero, clouds) => {
			return utils.isEmpty(queuedCollision) && clouds.length > 0
		}
	)

	self.cloudIsReady = makePredicate(
		['currStep'],
		currStep => currStep % 150 === 0)

	self.offscreen = makePredicate(
		['hero', 'currStep'],
		(hero, currStep) => {

			const coords = hero.position(currStep)

			const isOffscreen =
				coords.y1 > constants.bound.y1 ||
				coords.x0 < constants.bound.x0 ||
				coords.x1 > constants.bound.x1

			return isOffscreen
		}
	)

	self.flying = makePredicate(
		['hero'], hero => hero.locomotion === 'flying')

	self.falling = makePredicate(
		['hero'], hero => hero.locomotion === 'falling')

	self.notFalling = makePredicate(
		['hero'], hero => hero.locomotion !== 'falling')

	self.colliding = makePredicate(
		['queuedCollision', 'currStep'],
		(queuedCollision, currStep) => {
			return !utils.isEmpty(queuedCollision) && queuedCollision.time === currStep
		}
	)

	self.isDead = makePredicate(
		['hero'], hero => hero.isDead)

	self.isAlive = makePredicate(
		['hero'], hero => !hero.isAlive)

	return self

} )()












/*
	check

	Ensure that certain properties of
	the state are invariant for each step of the
	game.
*/
const check = ( function () {

	const is = {
		whole:
			val => {
				return val === val && val % 1 === 0
			},
		number:
			val => {
				return val === val
			},
		bool:
			val => {
				return val === false || val === true
			},
		func:
			val => {
				return val && typeof val === 'function'
			},
		string:
			val => {
				return Object.prototype.toString.call(val) === "[object String]"
			}
	}


	return state => {

		/*
		check that certain properties are true for a predicate.
		*/
		const check = (gets, predicate, onErr) => {

			const visible = gets.map(prop => state[prop])
			const hasProp = predicate.apply(null, visible)

			if (hasProp !== true) {
				throw onErr.apply(null, visible)
			}
		}

		/*
		Check the simple numeric state properties.
		*/
		check(['score'],     is.number,
			score => "score not number.")

		check(['nextCloud'], is.number,
			score => "nextCloud not number.")

		check(['currStep'],  is.number,
			score => "currStep not number.")


		/*
		Check the collision object and its properties.
		*/
		check(['queuedCollision'],
			obj   => {
				return utils.isEmpty(obj) ?
					true :
					'time'       in obj &&
					'position'   in obj &&
					'locomotion' in obj
			},
			obj => "properties missing from queuedCollision.")

		check(['queuedCollision'],
			obj   => {
				return utils.isEmpty(obj) ?
					true :
					is.number(obj.time) && is.func(obj.position) && is.string(obj.locomotion)
			},
			obj => "collision properties wrong types.")


	}

} )()










/*
	update

	This module returns a function that - given the
	game state at state.currStep - returns the state at state.currStep + 1
*/
var update = ( function () {

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state

			if (condition(state)) {
				state.reactions = state.reactions.concat([reaction])
			}
		}

		when(currently.cloudIsReady,       react.addClouds)

		when(currently.isCloudy,           react.removeOldClouds)

		when(currently.offscreen,          react.killHero)

		when(currently.noQueuedCollisions, react.scheduleCollision)

		when(currently.colliding,          react.alterCourse)

		/*
			consume every event in the queue, in order.
		*/

		for (var ith = 0; ith < state.reactions.length; ith++) {
			var reaction = state.reactions[ith]

			if (reaction) {
				state = reaction(state)
			}
		}

		state.reactions = []
		state.currStep = state.currStep + 1

		return state
	}

} )()











/*
	draw

	This module returns a function that handles all canvas
	drawing for the game.
*/
const draw = ( function () {

	const makeRenderer = (gets, renderer) => {
		return makeReaction(gets, [], renderer)
	}

	var render = {}

	render.cloud = makeRenderer(['clouds', 'currStep'], (clouds, currStep) => {

		ctx.fillStyle = constants.colours.white

		clouds.forEach(cloud => {

			var coords = cloud.position(currStep)

			ctx.fillRect(
				coords.x0, coords.y0,
				constants.cloudWidth, constants.cloudHeight)
		})
	})

	render.score = makeRenderer(['score', 'currStep'], (score, currStep) => {

		ctx.font = "30px Monospace"

		ctx.fillText(
			score + "",
			constants.score.x, constants.score.y)

		if (constants.debug) {
			ctx.fillText(
				currStep + "",
				constants.score.x + 50, constants.score.y)
		}

	})

	render.deathScreen = makeRenderer(['score'], score => {
		ctx.fillStyle = 'rgba(0,0,0,0.6)'

		ctx.fillRect(
			constants.bound.x, constants.bound.y,
			constants.bound.x, constants.bound.y)

		ctx.fillStyle = constants.colours.blue

		ctx.fillRect(
			constants.bound.x0, 200,
			constants.bound.x1, 100)

		ctx.font = "20px Monospace"

		ctx.fillStyle = constants.colours.white

		ctx.fillText(
			"You ran out of cluck. " +
			"Score: " + score,
			constants.score.x, 265)
	})

	render.hero = makeRenderer(['hero', 'currStep'], (hero, currStep) => {


		if (constants.debug) {
			for (var ith = 0; ith < 500; ith++) {
				var p = hero.position(2 * ith)

				ctx.fillStyle = 'rgba(0,0,0,0.05)'
				ctx.fillRect(p.x0, p.y0, 3, 3)

			}
			ctx.stroke()
		}


		const birdy = document.getElementById("bird-asset")

		const coords = hero.position(currStep)

		if (hero.locomotion === "standing") {

			var angle = hero.angle

		} else {

			const coords1 = hero.position(currStep + 0.01)

			const dist = {
				x: coords.x0 - coords1.x0,
				y: coords.y0 - coords1.y0
			}

			if (dist.y === 0) {
				var angle = 0
			} else {
				var angle = -Math.atan2(dist.x, dist.y) + (270) * 3.14 / 180
			}
		}

		var coordsPrime = {
			x0:  Math.cos(angle) * coords.x0 + Math.sin(angle) * coords.y0,
			y0: -Math.sin(angle) * coords.x0 + Math.cos(angle) * coords.y0
		}

		coordsPrime.x0 -= 16
		coordsPrime.y0 -= 16

		ctx.save();

		ctx.rotate(angle)

		ctx.drawImage(birdy, coordsPrime.x0, coordsPrime.y0)
		ctx.restore();

		if (constants.debug) {
			ctx.fillStyle = 'rgba(0,0,0,0.3)'
			ctx.fillRect(
				coords.x0, coords.y0,
				constants.heroWidth, constants.heroHeight
			)
		}

	})

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state.

			if (condition(state)) {
				reaction(state)
			}
		}
		can.width = can.width

		when(currently.isCloudy, render.cloud)
		when(currently.isDead,   render.deathScreen)
		when(currently.isAlive,  render.score)
		when(currently.isAlive,  render.hero)
	}

} )()










/*
	This module attaches event listeners to the canvas.
*/
;( function () {

	/*
	Add a reaction when a particular event is triggered.
	*/
	const upon = function (event, response) {

		can.addEventListener(event, event => {
			state.reactions = state.reactions.concat([ response(event) ])
		})
	}

	/*
	Stop flying, or start jumping.
	*/
	upon('mousedown', event => {

		return state.hero.locomotion === "flying" ?
			react.clipWings :
			react.queueJump(utils.getTime())
	})

	/*
	Launch the jump.
	*/
	upon('mouseup', event => {
		return react.takeOff(event.pageX, event.pageY, utils.getTime())
	})

	/*
	Rotate the grouse, based on the mouse location.
	*/
	upon('mousemove', event => {
		return react.setAngle(event.pageX, event.pageY)
	})

} )()










/*
	This module contains the main game loop, and
	the code that ends the game.
*/
;( function () {

	/*
		repeatedly update the state.
	*/
	const loop = function () {

		if (!state.hero.isDead) {

			state = update(state)
			check(state)
			draw(state)

		} else {
			clearInterval(GAMEID)
		}
	}

	const GAMEID = setInterval(loop, 1000 / 60)

} )()
