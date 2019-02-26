/* global geo */

/* Quintic Hermite Spline for 2 dimensions */
class Spline2
{
    constructor(splineX, splineY)
    {
        this.x = splineX;
        this.y = splineY;
        this.evalCache = null;
    }

    static fromControlPoints(xk0, yk0, xdk0, ydk0, xddk0, yddk0,
                             xk1, yk1, xdk1, ydk1, xddk1, yddk1)
    {
        return new Spline2(
                        new geo.Spline1(xk0, xdk0, xddk0, xk1, xdk1, xddk1),
                        new geo.Spline1(yk0, ydk0, yddk0, yk1, ydk1, yddk1)
                    );
    }

    static fromPoses(p0, p1)
    {
        const p0Xlate = p0.getTranslation();
        const p0Rotate = p0.getRotation();
        const p1Xlate = p1.getTranslation();
        const p1Rotate = p1.getRotation();
        const scale = 1.2 * p0Xlate.distance(p1Xlate);
        return Spline2.fromControlPoints(
                    p0Xlate.x, p0Xlate.y,
                    p0Rotate.cos*scale, p0Rotate.sin*scale, // p0 tangent
                    0, 0, // no curvature from poses
                    p1Xlate.x, p1Xlate.y,
                    p1Rotate.cos*scale, p1Rotate.sin*scale, // p1 tangent
                    0, 0 // no curvature from poses
        );
    }

    // used to evaluate perform partial derivs along x
    static fromSpline2VaryDDX(spline, ddx0, ddx1)
    {
        return new Spline2(
                geo.Spline1.fromSplineVaryDD(spline.x, ddx0, ddx1), 
                spline.y);
    }
    
    // used to evaluate perform partial derivs along y
    static fromSpline2VaryDDY(spline, ddy0, ddy1)
    {
        return new Spline2(spline.x, 
                geo.Spline1.fromSplineVaryDD(spline.y, ddy0, ddy1));
    }
    
    getStartPose()
    {
        return this.getPose(0);
    }

    getEndPose()
    {
        return this.getPose(1);
    }

    getPose2dWithCurvature(t)
    {
        let pose = this.getPose(t);
        pose.curvature = this.getCurvature(t);
        pose.dcurvature = this.getDCurvature(t) / this.getVelocity(t);
        return pose;
    }

    getPose(t)
    {
        if(this.evalCache == null || this.evalCache.t != t)
            this.evalCache = { t: t };
        if(this.evalCache.x == undefined)
        {
            this.evalCache.x = this.x.getPosition(t);
            this.evalCache.y = this.y.getPosition(t);
        }
        if(this.evalCache.dx == undefined)
        {
            this.evalCache.dx = this.x.getTangent(t);
            this.evalCache.dy = this.y.getTangent(t);
        }
        return new geo.Pose2d(new geo.Translation2d(this.evalCache.x, 
                                                    this.evalCache.y),
                              new geo.Rotation2d(this.evalCache.dx, 
                                                this.evalCache.dy, true));
    }

    getVelocity(t) // a scalar quantity, ie: tangential speed
    {
        if(this.evalCache == null || this.evalCache.t != t)
            this.evalCache = { t: t };
        if(this.evalCache.dx == undefined)
        {
            this.evalCache.dx = this.x.getTangent(t);
            this.evalCache.dy = this.y.getTangent(t);
        }
        return Math.hypot(this.evalCache.dx, this.evalCache.dy);
    }

    getHeading(t)
    {
        if(this.evalCache == null || this.evalCache.t != t)
            this.evalCache = { t: t };
        if(this.evalCache.dx == undefined)
        {
            this.evalCache.dx = this.x.getTangent(t);
            this.evalCache.dy = this.y.getTangent(t);
        }
        return new geo.Rotation2d(this.evalCache.dx, this.evalCache.dy, true);
    }

    getCurvature(t)
    {
        /* http://mathworld.wolfram.com/Curvature.html, eq 13 */
        if(this.evalCache == null || this.evalCache.t != t)
            this.evalCache = { t: t };
        if(this.evalCache.dx == undefined)
        {
            this.evalCache.dx = this.x.getTangent(t);
            this.evalCache.dy = this.y.getTangent(t);
        }
        if(this.evalCache.ddx == undefined)
        {
            this.evalCache.ddx = this.x.getCurvature(t);
            this.evalCache.ddy = this.y.getCurvature(t);
        }
        const c = this.evalCache;
        return (c.dx*c.ddy - c.ddx*c.dy) /
                ((c.dx*c.dx + c.dy*c.dy)*Math.sqrt((c.dx*c.dx + c.dy*c.dy)));
    }

    getDCurvature(t)
    {
        if(this.evalCache == null || this.evalCache.t != t)
            this.evalCache = { t: t };
        if(this.evalCache.dx == undefined)
        {
            this.evalCache.dx = this.x.getTangent(t);
            this.evalCache.dy = this.y.getTangent(t);
        }
        if(this.evalCache.ddx == undefined)
        {
            this.evalCache.ddx = this.x.getCurvature(t);
            this.evalCache.ddy = this.y.getCurvature(t);
        }
        if(this.evalCache.dddx == undefined)
        {
            this.evalCache.dddx = this.x.getDCurvature(t);
            this.evalCache.dddy = this.y.getDCurvature(t);
        }
        const c = this.evalCache;
        const dx2dy2 = (c.dx*c.dx + c.dy*c.dy);
        const num = (c.dx*c.dddy - c.dddx*c.dy)*c.dx2dy2 -
            3 * (c.dx*c.ddy - c.ddx*c.dy) * (c.dx*c.ddx + c.dy*c.ddy);
        return num / (dx2dy2 * dx2dy2 * Math.sqrt(dx2dy2));
    }

    getDCurvatureSq(t) // a little faster than getDCurvature
    {
        if(this.evalCache == null || this.evalCache.t != t)
            this.evalCache = { t: t };
        if(this.evalCache.dx == undefined)
        {
            this.evalCache.dx = this.x.getTangent(t);
            this.evalCache.dy = this.y.getTangent(t);
        }
        if(this.evalCache.ddx == undefined)
        {
            this.evalCache.ddx = this.x.getCurvature(t);
            this.evalCache.ddy = this.y.getCurvature(t);
        }
        if(this.evalCache.dddx == undefined)
        {
            this.evalCache.dddx = this.x.getDCurvature(t);
            this.evalCache.dddy = this.y.getDCurvature(t);
        }
        const c = this.evalCache;
        const dx2dy2 = (c.dx*c.dx + c.dy*c.dy);
        const num = (c.dx*c.dddy - c.dddx*c.dy) * dx2dy2 -
            3 * (c.dx*c.ddy - c.ddx*c.dy) * (c.dx*c.ddx + c.dy*c.ddy);
        return num * num / (dx2dy2 * dx2dy2 * dx2dy2 * dx2dy2 * dx2dy2);       
    }

    sumDCurveSq(numSamples)
    {
        const dt = 1.0 / numSamples;
        let sum = 0.;
        for(let t = 0; t<1.0; t += dt)
        {
            sum += dt * this.getDCurvatureSq(t);
        }
        return sum;
    }
}

if(window.geo == undefined)
    window.geo = {};

window.geo.Spline2 = Spline2;