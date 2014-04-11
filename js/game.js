
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

	self.cloudWidth   = 140                         // the pixel width of each cloud.
	self.cloudHeight  = 140 / Math.pow(1.618, 3)    // the pixel height of each cloud.

	self.gravity      = 9.81 / 60                   // the gravitational acceleration.

	self.colours = {
		blue: "#3498db",
		white: "#ecf0f1",
		black: "black"
	}

	self.heroWidth    = 32                          // .
	self.heroHeight   = 32                          //

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
		x: 0.150,
		y: 0.875
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

			self.ax = self.ax || 0
			self.ay = self.ay || 0

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

state = ( function () {

	var self = {}

	self.hero = {
		position: motion.flying({
			x0: 10,
			x1: 10 + constants.heroWidth,

			y0: constants.cloudRange.y + 50,
			y1: constants.cloudRange.y + 50 + constants.heroHeight,

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
	self.collisions = {}

	self.score      = 0
	self.nextCloud  = 0
	self.currStep   = 1

	return self

} )()










const makeReaction = (gets, sets, reaction) => {
	/*
	creates a reaction function that accesses and alters part
	of the state.
	*/

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

	self.addClouds = makeReaction(
		['clouds', 'currStep', 'nextCloud'], ['clouds', 'nextCloud'],
		(clouds, currStep, nextCloud) => {
			/*
			Add a new cloud.
			*/

			const y0 = utils.randBetween(
				0.150 * constants.bound.y1 - constants.heroHeight - 10,
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

	self.removeOldClouds = makeReaction(
		['clouds', 'currStep'], ['clouds'],
		(clouds, currStep) => {
			/*
			Remove the clouds that drift off-screen.
			*/

			const filteredClouds = clouds.filter(cloud => {
				return cloud.position(currStep).x0 > constants.bound.x0
			})

			return {
				clouds: filteredClouds
			}
		}
	)

	self.clipWings = makeReaction(
		['hero', 'currStep'], ['hero', 'collisions'],
		(hero, currStep) => {
			/*
			Swap the initial flying sin-wave motion function for a
			falling motion function.
			*/

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
				collisions: {}
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
			['hero', 'clouds',  'currStep'], ['collisions'],
			(hero, clouds, currStep) => {

				var collision = {
					time: Infinity,
					locomotion: "standing"
				}

				for (cloud of clouds) {

					var cloudCoords = cloud.position(0, true)

					var fn = t => {
						return hero.position(t).y1 - cloudCoords.y0
					}
					var fnPrime = t => {
						return (fn(t + 0.1) - fn(t)) / 0.1
					}

					var root = constants.bound.x1

					for (var ith = 0; ith < 500; ith++) {
						root -= fn(root) / fnPrime(root)
					}

					if (root < currStep || root > currStep + 1000) {
						return {}
					}

					// set better upper bound
					var futureCloud = cloud.position(root)
					var futureHero  = hero.position(root)

					var isAlignedX =
						(futureHero.x1 > futureCloud.x0) && (futureHero.x0 < futureCloud.x1)

					if (isAlignedX && root < collision.time) {

						if (fnPrime(root) > 0) {

							collision.time = root

							collision.position = motion.falling({
								x0: futureHero.x0,
								x1: futureHero.x1,

								y0: futureHero.y0,
								y1: futureHero.y1,

								vx: constants.pixelDx,

								init: root
							})

							collision.locomotion = "standing"

						} else {

						}
					}
				}

				// a hack
				if (collision.time > 5000) {
					return {collisions: {}}
				}

				return {
					collisions: collision
				}

			}
		)

	} )()










	self.alterCourse = makeReaction(
		['hero', 'collisions', 'score'], ['hero', 'collisions', 'score'],
		(hero, collisions, score) => {
			/*
			The pre-calculated collision point has
			been reached, so we need to swap out
			the current player's motion function forst
			the pre-computed motion function.
			*/

			hero.position   = collisions.position
			hero.locomotion = collisions.locomotion

			if (hero.lastCloud !== collisions.cloudId) {
				score += 1
				hero.lastCloud = collisions.cloudId
			}

			return {
				hero: hero,
				collisions: {},
				score: score
			}
		}
	)

	self.endGame = makeReaction(
		['hero'], ['hero'],
		(hero) => {
			/*
			The game is over.
			*/

			hero.isDead = true
			return {hero: hero}
		}
	)

	self.beginJumpPowerup = time => {
		return makeReaction(
			['hero'], ['hero'],
			(hero) => {
				/*
				register that we are getting ready to jump.
				*/

				if (hero.locomotion === 'standing' || hero.locomotion === "falling") {
					hero.jump = {
						'time': time
					}
				}

				return {hero: hero}
			}
		)
	}

	self.takeOff = (x, y, time) => {
		return makeReaction(
			['hero', 'currStep'], ['hero'],
			(hero, currStep) => {

				if (hero.locomotion !== "standing") {
					return {hero: hero}
				}

				const holdDuration = time - hero.jump.time
				const coords = hero.position(currStep)

				var mouse = utils.asCanvasMouseCoords(x, y)

				var dist = {
					x: +Math.abs(mouse.x - coords.x1),
					y: -Math.abs(mouse.y - coords.y1)
				}

				var angle = Math.atan(dist.y / dist.x)

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

				return {hero: hero}
			})
	}

	self.setAngle = (x, y) => {
		return makeReaction(
			['hero', 'currStep'], ['hero'],
			(hero, currStep) => {

				const mouse = utils.asCanvasMouseCoords(x, y)
				const heroCoords = hero.position(currStep)

				var dist = {
					x: mouse.x - heroCoords.x1,
					y: mouse.y - heroCoords.y1
				}

				if (dist.y === 0) {
					var angle = 0
				} else {
					var angle = -Math.atan2(dist.x, dist.y) - (270) * 3.14/180
				}

				hero.angle = angle

				return {hero: hero}
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

	const makeInspector = (gets, inspector) => {
		/*
		creates a reaction function that accesses and alters part
		of the state.
		*/

		return state => {

			const visible = gets.map(prop => state[prop])
			return inspector.apply(null, visible)
		}
	}

	self.isCloudy = makeInspector(['clouds'],
		clouds => clouds.length > 0)

	self.noFutureCollisions = makeInspector(
		['collisions', 'hero', 'clouds'],
		(collisions, hero, clouds) => {
			return utils.isEmpty(collisions) && clouds.length > 0
		}
	)

	self.cloudIsReady = makeInspector(
		['currStep'],
		currStep => currStep % 150 === 0)

	self.offscreen = makeInspector(
		['hero', 'currStep'],
		(hero, currStep) => {

			const coords = hero.position(currStep)

			const isOffscreen = coords.y1 > constants.bound.y1 ||
				coords.x0 < constants.bound.x0 ||
				coords.x1 > constants.bound.x1

			return isOffscreen
		}
	)

	self.flying = makeInspector(
		['hero'], hero => hero.locomotion === 'flying')

	self.falling = makeInspector(
		['hero'], hero => hero.locomotion === 'falling')

	self.notFalling = makeInspector(
		['hero'], hero => hero.locomotion !== 'falling')

	self.colliding = makeInspector(
		['collisions', 'currStep'],
		(collisions, currStep) => {
			return !utils.isEmpty(collisions) && collisions.time < currStep
		}
	)

	self.isDead = makeInspector(
		['hero'], hero => hero.isDead)

	self.isAlive = makeInspector(
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
			}
	}


	return state => {

		const check = (gets, property, onErr) => {

			const visible = gets.map(prop => state[prop])
			const hasProp = property.apply(null, visible)

			if (hasProp !== true) {
				throw onErr.apply(null, visible)
			}
		}

		check(['score'], is.number,
			score => "score not number.")

		check(['nextCloud'], is.number,
			score => "nextCloud not number.")

		check(['currStep'], is.number,
			score => "currStep not number.")

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

		when(currently.cloudIsReady, react.addClouds)

		when(currently.isCloudy, react.removeOldClouds)

		when(currently.offscreen, react.endGame)

		when(currently.noFutureCollisions, react.scheduleCollision)

		when(currently.colliding, react.alterCourse)

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
		when(currently.isDead, render.deathScreen)
		when(currently.isAlive, render.score)
		when(currently.isAlive, render.hero)
	}

} )()










;( function () {
	/*
		This module attaches event listeners to the canvas.
	*/

	const upon = function (event, response) {
		//

		can.addEventListener(event, event => {
			state.reactions = state.reactions.concat([ response(event) ])
		})
	}

	upon('mousedown', event => {

		if (state.hero.locomotion === "flying") {
			return react.clipWings
		} else {
			return react.beginJumpPowerup(utils.getTime())
		}
	})

	upon('mouseup', event => {

		return react.takeOff(
			event.pageX, event.pageY, utils.getTime())
	})

	upon('mousemove', event => {
		return react.setAngle(event.pageX, event.pageY)
	})

} )()










;( function () {
	/*
		This module contains the main game loop, and
		the code that ends the game.
	*/

	const loop = function () {
		/*
			repeatedly update the state.
		*/

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
